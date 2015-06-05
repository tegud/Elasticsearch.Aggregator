var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

var _ = require('lodash');
var Promise = require('bluebird');

var modules;

function loadModules() {
	return new Promise(function(resolve, reject) {
		if(modules) {
			return resolve(modules);
		}
		
		fs.readdir(__dirname, function(err, files) {
			if(err) {
				return reject(err);
			}
			
			modules = _.chain(files).filter(function(file) { 
				return (file !== 'index.js' && file !== 'utilities.js') || file.lastIndexOf('.') < 0;
				}).map(function(file) {
				var moduleName = file.substring(0, file.indexOf('.'));
				
				return { 
					name: moduleName,
					module: require('./' + moduleName)
				};
			}).value();
			
			resolve(modules);
		});
	});
}

var defaults = {
	nameGenerator: function defaultFileNameGenerator(moduleName, index) {
		return moduleName + '.json';
	},
	mapper: function defaultMapper(data) {
		return new Promise(function(resolve, reject) {
			resolve(data);
		});
	},
	save: function defaultSave(folder, fileName, data) {
		return new Promise(function(resolve, reject) {
			mkdirp(folder, function(err) {
				fs.writeFile(path.join(folder, fileName), JSON.stringify(data, null, 4), 'utf-8', resolve);
			});
		});
	}
};

function checkIfFileExists(fullPath) {
	return new Promise(function(resolve, reject) {
		fs.exists(fullPath, function(exists) {
			resolve(exists);
		});
	});
}

function runModules(client, index) {
	return Promise.all(_.map(modules, function(currentModuleAndName) {
		return new Promise(function(resolve, reject) {
			var currentModuleName = currentModuleAndName.name;
			var currentModule = currentModuleAndName.module;
			
			var fileNameGenerator = currentModule.fileNameGenerator || defaults.nameGenerator;
			var query = currentModule.query;
			var map = currentModule.map || defaults.mapper;
			var save = currentModule.save || defaults.save;

			var fileName = fileNameGenerator(currentModuleName, index);
			var folder = path.join(__dirname, '../output', index);
			var fullFilePath = path.join(folder, fileName);
			
			return checkIfFileExists(fullFilePath)
				.then(function(exists) {
					if(exists) {
						return resolve();
					}

					return query(client, index)
						.then(map)
						.then(save.bind(null, folder, fileName));
						//.then(resolve);
				});
		});
	}));
}

module.exports = {
	runAll: function(client, index) {
		return loadModules().then(runModules.bind(null, client, index));
	}
};

