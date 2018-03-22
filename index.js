var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var https = require('https');
var http = require('http');
var qs = require('querystring');
var zlib = require('zlib');

var plantUml = require('./plantuml_encode');

var options = {
	"umlPath": "assets/images/uml",
	"type": "plantuml-service",
	"host": "plantuml-service.herokuapp.com",
	"port": "80",
	"protocol": "https",
	"path": "/svg/",
	"blockRegex": "^```uml((.*[\r\n])+?)?```$",
	"language": "markdown"
}

require('shelljs/global');


function plantumlServerEscape(block) {
	//UTF8
	var toDeflate = unescape(encodeURIComponent(block));
	var deflated = zlib.deflateRawSync(toDeflate, { level: 9 });
	return plantUml.encode64(deflated);
}

module.exports = {
	hooks: {
		"init": function () {
			var output = this.output;
			var config = this.config.values.pluginsConfig["plantuml-cloud-languages"];

			if (config.umlPath != undefined) {
				options.umlPath = config.umlPath;
			}
			if (config.type != undefined) {
				options.type = config.type;
			}
			if (config.host != undefined) {
				options.host = config.host;
			}
			if (config.port != undefined) {
				options.port = config.port;
			}
			if (config.protocol != undefined) {
				options.protocol = config.protocol;
			}
			if (config.path != undefined) {
				options.path = config.path;
			}
			if (config.blockRegex != undefined) {
				options.blockRegex = config.blockRegex;
			}
			if (config.language != undefined) {
				options.language = config.languague;
			}

			var umlPath = output.resolve(options.umlPath);
			mkdir('-p', umlPath);
		},
		"page:before": function (page) {
			var output = this.output;
			var content = page.content;

			var umls = [];
			var re = new RegExp(options.blockRegex, 'img');

			while ((match = re.exec(content))) {
				var rawBlock = match[0];
				var umlBlock = match[1];
				var md5 = crypto.createHash('md5').update(umlBlock).digest('hex');
				var svgPath = path.join(options.umlPath, md5 + '.svg');
				umls.push({
					rawBlock: match[0],
					umlBlock: match[1],
					svgPath: svgPath
				});
			}

			Promise.all([umls.map(uml => {
				var svgTag = '';
				if (options.language = 'markdown') {
					svgTag = '![](/' + uml.svgPath + ')';
				}
				if (options.language = 'asciidoc') {
					svgTag = 'image::' + uml.svgPath + '[]';
				}
				page.content = content = content.replace(uml.rawBlock, svgTag);

				return output.hasFile(uml.svgPath).then(exists => {
					if (!exists) {
						return new Promise((resolve, reject) => {

							var client = http;
							if (options.protocol == "https") {
								client = https;
							}

							var path = options.path + qs.escape(uml.umlBlock);
							if (options.type == "plantuml-server") {
								path = options.path + plantumlServerEscape(uml.umlBlock);
							}

							client.request({
								host: options.host,
								path: path,
								port: options.port
							}, (res) => {
								var ws = fs.createWriteStream(output.resolve(uml.svgPath));
								res.pipe(ws);
								res.on('end', resolve);
							}).end();
						});
					}
				})
			})]);

			return page;
		},

		"page": function (page) { return page; },
		"page:after": function (page) { return page; }
	}
};
