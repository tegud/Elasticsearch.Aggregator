var fs = require('fs');
var _ = require('lodash');

function cloneObject(obj) {
	return JSON.parse(JSON.stringify(obj))
}

function applyMetricsToAggregations(aggs, metrics) {
	var mergedAggs = aggs;

	_.each(aggs, function(subAgg, key) {
		if(key === 'aggs') {
			aggs[key] = applyMetricsToAggregations(aggs[key], metrics);

			aggs[key] = _.merge(aggs[key], cloneObject(metrics));
		}
		else if(subAgg.aggs) {
			aggs[key].aggs = applyMetricsToAggregations(aggs[key].aggs, metrics);

			aggs[key].aggs = _.merge(aggs[key].aggs, cloneObject(metrics));
		}
		else {
			aggs[key].aggs = cloneObject(metrics);
		}
	});

	return mergedAggs;
}

function generateQuery(query, splits, metrics) {
	var aggs = cloneObject(splits);

	aggs = applyMetricsToAggregations(aggs, metrics);

	var fullQuery = {
		"query": query,
		"aggs": {
			"bytime": _.merge({
				"date_histogram":{
					"min_doc_count": 0,
					"field": "@timestamp",
					"interval": "1h"
				}
			}, aggs)
		},
		"size": 0
	};

	// console.log(JSON.stringify(fullQuery, null, 4));

	return fullQuery;
}

function getMetricsFromResult(metrics, result) {
	var metricResult = _.reduce(metrics, function(metricResult, currentMetric, key) {
		metricResult[key] = result[key].value;

		return metricResult;
	}, {});


	return metricResult
}

function getValuesFrom(aggregations, metrics, results) {
	var result = _.reduce(aggregations.aggs, function(current, aggregation, key) {
		var aggregationType = _.chain(aggregation).map(function(aggregationConfiguration, key) { return key; }).filter(function(key) {
			return key !== 'aggs' && key !== 'aggregations';
		}).first().value();

		if(aggregationType === 'filter') {
			current[key] = _.merge({
				total: results[key].doc_count
			}, getMetricsFromResult(metrics, results[key]));
		}
		else if (aggregationType === 'terms') {
			current[key] = _.map(results[key].buckets, function(termItem) {
				return _.merge({
					term: termItem.key,
					total: termItem.doc_count
				}, getValuesFrom(aggregation, metrics, termItem));
			});
		}

		return current;
	}, {});

	result = _.merge(result, getMetricsFromResult(metrics, results));

	// console.log(JSON.stringify(result, null, 4));

	return result;
}

function getValues(splits, metrics, results) {
	return _.map(results.aggregations.bytime.buckets, function(bucket) {
		var aggregationValues = getValuesFrom(splits, metrics, bucket);

		return _.merge({
			datetime: bucket.key_as_string,
			total: bucket.doc_count
		}, aggregationValues)
	});
}

function standardQuery(filters, aggregations, metrics) {
	var query = generateQuery(filters, { aggs: aggregations }, metrics);
	var getValuesForData = getValues.bind(undefined, { aggs: aggregations }, metrics);

	return {
		query: function(client, index) {
			return client.search({
				index: index,
				body: query
			});
		},
		map: getValuesForData
	}
}

module.exports = {
	loadStandardQueryFromFile: function(filePath) {
		var fileContents = fs.readFileSync(filePath, 'utf8');
		var parsedContents = JSON.parse(fileContents);

		return standardQuery(parsedContents.filters, parsedContents.aggregations, parsedContents.metrics);
	},
	standardQuery: standardQuery,
	generateQuery: generateQuery,
	getValues: getValues
};
