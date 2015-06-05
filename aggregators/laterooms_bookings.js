var Promise = require('bluebird');
var _ = require('lodash');

module.exports = {
	query: function(client, index) {
		return client.search({
			index: index,
			body: {
				"query":{
					"filtered":{
						"filter":{
							"bool":{
								"must":[
									{
										"term":{
											"type":"domain_events"
										}
									},
									{
										"term":{
											"domainEventType.raw": "booking made"
										}
									}
								]
							}
						}
					}
				},
				"aggs":{
					"bytime":{
						"date_histogram":{
							"min_doc_count": 0,
							"field": "@timestamp",
							"interval": "1h"
						},
						"aggs":{
							"totalCommission": {
								"sum": {
									"field": "commissionValue"
								}
							},
							"totalValue": {
								"sum": {
									"field": "totalAmountGbp"
								}
							},
							"affiliate": {
								"terms": {
									"field": "hotelProvider.raw",
									"size": 1000
								},
			                    "aggs": {
			                    	"totalCommission": {
										"sum": {
											"field": "commissionValue"
										}
									},
									"totalValue": {
										"sum": {
											"field": "totalAmountGbp"
										}
									},
									"test": {
										"filter": {
					                        "term": {
					                            "isTestBooking": true
					                        }
					                    },
					                    "aggs": {
					                    	"totalCommission": {
												"sum": {
													"field": "commissionValue"
												}
											},
											"totalValue": {
												"sum": {
													"field": "totalAmountGbp"
												}
											}
					                    }
									},
									"live": {
										"filter": {
					                        "term": {
					                            "isTestBooking": false
					                        }
					                    },
					                    "aggs": {
					                    	"totalCommission": {
												"sum": {
													"field": "commissionValue"
												}
											},
											"totalValue": {
												"sum": {
													"field": "totalAmountGbp"
												}
											}
					                    }
									}
			                    }
							},
							"test": {
								"filter": {
			                        "term": {
			                            "isTestBooking": true
			                        }
			                    },
			                    "aggs": {
			                    	"totalCommission": {
										"sum": {
											"field": "commissionValue"
										}
									},
									"totalValue": {
										"sum": {
											"field": "totalAmountGbp"
										}
									}
			                    }
							},
							"live": {
								"filter": {
			                        "term": {
			                            "isTestBooking": false
			                        }
			                    },
			                    "aggs": {
			                    	"totalCommission": {
										"sum": {
											"field": "commissionValue"
										}
									},
									"totalValue": {
										"sum": {
											"field": "totalAmountGbp"
										}
									}
			                    }
							}
						}
					}
				},
				"size": 0
			}
		});
	},
	map: function(data) {
		return new Promise(function(resolve, reject) {
			resolve(_.map(data.aggregations.bytime.buckets, function(bucket) {
				return {
					datetime: bucket.key_as_string,
					byAffiliate: _.map(bucket.affiliate.buckets, function(affiliateBucket) {
						return {
							name: affiliateBucket.key,
							all: { count: affiliateBucket.doc_count, commission: affiliateBucket.totalCommission.value, totalValue: affiliateBucket.totalValue.value },
							test: { count: affiliateBucket.test.doc_count, commission: affiliateBucket.test.totalCommission.value, totalValue: affiliateBucket.test.totalValue.value },
							live: { count: affiliateBucket.live.doc_count, commission: affiliateBucket.live.totalCommission.value, totalValue: affiliateBucket.live.totalValue.value }
						};
					}),
					all: { count: bucket.doc_count, commission: bucket.totalCommission.value, totalValue: bucket.totalValue.value },
					test: { count: bucket.test.doc_count, commission: bucket.test.totalCommission.value, totalValue: bucket.test.totalValue.value },
					live: { count: bucket.live.doc_count, commission: bucket.live.totalCommission.value, totalValue: bucket.live.totalValue.value }
				};
			}));
		});
	}
};
