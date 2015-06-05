var utilities = require('./utilities');

var filters = {
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
};

var aggregations = {
	"affiliate": {
		"terms": {
			"field": "hotelProvider.raw",
			"size": 1000
		},
        "aggs": {
			"test": {
				"filter": {
                    "term": {
                        "isTestBooking": true
                    }
                }
			},
			"live": {
				"filter": {
                    "term": {
                        "isTestBooking": false
                    }
                }
			}
        }
	},
	"affiliate": {
		"terms": {
			"field": "affiliateName.raw",
			"size": 1000
		},
        "aggs": {
			"test": {
				"filter": {
                    "term": {
                        "isTestBooking": true
                    }
                }
			},
			"live": {
				"filter": {
                    "term": {
                        "isTestBooking": false
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
        }
	},
	"live": {
		"filter": {
            "term": {
                "isTestBooking": false
            }
        }
	}
};

var metrics = {
	totalCommission: { "sum": { "field": "commissionValue" } },
	totalValue: { "sum": { "field": "totalAmountGbp" } }
};

module.exports = utilities.standardQuery(filters, aggregations, metrics);
