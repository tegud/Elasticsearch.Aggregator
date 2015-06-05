var moment = require('moment');
var elasticsearch = require('elasticsearch');
var _ = require('lodash');
var http = require('http');
var request = require('request');
var Promise = require('bluebird');
var Aggregators = require('./aggregators');

var host = 'http://logs.laterooms.com:9200';

var client = elasticsearch.Client({
	host: host
});

function prettyDuration(durationInMs) {
	var minutes = durationInMs / 1000 / 60;
	var seconds = (durationInMs / 1000) % 60;
	var hours = 0;

	if(minutes > 60) {
		hours = minutes / 60;
		minutes = minutes % 60
	}

	return (hours ? hours.toFixed(0) + ' hr' + (hours !== 1 ? 's' : '')  + ', ' : '')
		+ minutes.toFixed(0) + 'min' + (minutes !== 1 ? 's' : '')
		+ seconds.toFixed(0) + 'sec' + (seconds !== 1 ? 's' : '');
}

function indexReady(index, snapshotName) {
	return pollUntilIndexIsReady(index)
		.then(function() {
			console.log('Index recovered enough to retrieve data');

			return gatherData(index);
		});
}

function gatherData(index) {
	return Aggregators.runAll(client, index);
}

function pollUntilIndexIsReady(index) {
	var checks = 0;
	var checkInterval = 5000;
	var maxChecks = checkInterval * 60 * 5;

	function check(index, resolve, reject) {
		client.indices.recovery({index: index}, function(err, data) {
			var primaryShards = _.filter(data[index].shards, function(shard) { return shard.primary; });
			var primaryShardsInRecovery = _.filter(primaryShards, function(shard) { return shard.stage.toLowerCase() !== 'done'; });

			if(!primaryShardsInRecovery.length) {
				return resolve();
			}

			if(checks++ > maxChecks) {
				return reject();
			}

			console.log('Waiting on ' + primaryShardsInRecovery.length + ' of ' + data[index].shards.length + ' primary shards to recover on index: ' + index);

			setTimeout(check.bind(this, index, resolve, reject), checkInterval);
		});

	}

	return new Promise(function(resolve, reject) {
		console.log('Index opening, waiting until sufficiently recovered...');

		check(index, resolve, reject);
	});
}

var logstashIndexRegex = /logstash\-([0-9]{4}\.[0-9]{2}\.[0-9]{2})/i

client.cat.indices().then(function(d) {
	var lines = d.split('\n');
	var today = moment().utc();

	console.log('Found ' + lines.length + (lines.length === 1 ? ' index' : ' indicies'));

	var indicies = lines;

	var sortedTasks = _.chain(lines)
		.map(function(line) {
			var logstashIndexMatch = logstashIndexRegex.exec(line);
			var isClosed = line.indexOf('close') > -1 && line.indexOf('open') < 0;
			
			if(logstashIndexMatch) {
				var indexDate = moment(logstashIndexMatch[1], 'YYYY-MM-DD');
				var ruleMatched;

				return {
					index: logstashIndexMatch[0],
					isClosed: isClosed
				};
			}
		})
		.filter(function(index) { return index; })
		.sortBy(function(index) {
			if(!index) {
				return;
			}
			return index.index;
		}).value().reverse();

	function process(current) {
		if(current.isClosed) {
			console.log('Index ' + current.index + ' is closed, needs opening...');

			client.indices.open({ index: current.index })
				.catch(function() {
					console.log('Couldn\'t open index ' + current.index);
				})
				.then(indexReady.bind(this, current.index)).then(processNext);
		}
		else {
			console.log('Index ' + current.index + ' is already open');

			indexReady(current.index).then(processNext);
		}
	}
	var stop;
	var processNext = function processNext() {
		if(stop) { return; }
		var current = sortedTasks.pop();

		console.log('=================================');

		if(!current) {
			console.log('No more tasks left');
			return;
		}
		console.log(current.index + ' is next....');

		process(current);

		stop = true;
	};

	processNext();
});
