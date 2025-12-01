# Advanced Chart Test Suite (No Color Specifications)

This collection of test charts demonstrates various data patterns to test the enhanced chart accessibility features, without custom color specifications to allow your default palette settings to be applied.

[toc]

## 1. Complex Bar Chart: Skewed Distribution

This chart has a positively skewed distribution with outliers and varying degrees of variability.

```chart
{
  "type": "bar",
  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "datasets": [{
      "label": "Monthly Revenue",
      "data": [45, 42, 50, 46, 54, 59, 65, 74, 62, 68, 142, 53],
      "borderWidth": 1
    }]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Revenue ($ thousands)"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Month"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Monthly Revenue (Skewed Distribution)"
      }
    }
  }
}
```

## 2. Multi-Series Line Chart: Multiple Trends and Correlations

This chart shows multiple data series with different trend characteristics and correlations between them.

```chart
{
  "type": "line",
  "data": {
    "labels": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10", "Week 11", "Week 12"],
    "datasets": [
      {
        "label": "Product A Sales",
        "data": [12, 19, 25, 32, 45, 48, 50, 55, 59, 63, 58, 65],
        "borderWidth": 2,
        "tension": 0.3,
        "fill": true
      },
      {
        "label": "Product B Sales",
        "data": [18, 22, 20, 25, 27, 28, 32, 33, 35, 38, 40, 41],
        "borderWidth": 2,
        "tension": 0.3,
        "fill": true
      },
      {
        "label": "Marketing Spend",
        "data": [5, 15, 10, 20, 25, 15, 10, 20, 15, 25, 20, 15],
        "borderWidth": 2,
        "tension": 0.3,
        "fill": true
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Value ($ thousands)"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Week"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Sales and Marketing Trends"
      }
    }
  }
}
```

## 3. Pie Chart: Category Distribution

A pie chart to test categorical distribution analysis.

```chart
{
  "type": "pie",
  "data": {
    "labels": ["Direct Sales", "Partner Sales", "Online Store", "Retail Locations", "Affiliates"],
    "datasets": [
      {
        "label": "Sales Distribution",
        "data": [35, 25, 22, 13, 5],
        "borderWidth": 1
      }
    ]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Sales Channel Distribution (%)"
      }
    }
  }
}
```

## 4. Seasonal Trend Detection Test

This line chart has a clear seasonal pattern that should be detected by the trend analysis module.

```chart
{
  "type": "line",
  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan'", "Feb'", "Mar'", "Apr'", "May'", "Jun'", "Jul'", "Aug'", "Sep'", "Oct'", "Nov'", "Dec'"],
    "datasets": [
      {
        "label": "Product Demand",
        "data": [20, 18, 25, 30, 28, 35, 45, 42, 30, 25, 20, 32, 22, 19, 26, 32, 30, 38, 48, 45, 33, 28, 22, 35],
        "borderWidth": 2,
        "tension": 0.3,
        "fill": true
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Units (thousands)"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Month"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Seasonal Product Demand (2-Year Period)"
      }
    }
  }
}
```

## 5. Large Dataset Performance Test

This chart contains a large number of data points to test performance optimization.

```chart
{
  "type": "line",
  "data": {
    "labels": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7", "Day 8", "Day 9", "Day 10", "Day 11", "Day 12", "Day 13", "Day 14", "Day 15", "Day 16", "Day 17", "Day 18", "Day 19", "Day 20", "Day 21", "Day 22", "Day 23", "Day 24", "Day 25", "Day 26", "Day 27", "Day 28", "Day 29", "Day 30", "Day 31", "Day 32", "Day 33", "Day 34", "Day 35", "Day 36", "Day 37", "Day 38", "Day 39", "Day 40", "Day 41", "Day 42", "Day 43", "Day 44", "Day 45", "Day 46", "Day 47", "Day 48", "Day 49", "Day 50", "Day 51", "Day 52", "Day 53", "Day 54", "Day 55", "Day 56", "Day 57", "Day 58", "Day 59", "Day 60", "Day 61", "Day 62", "Day 63", "Day 64", "Day 65", "Day 66", "Day 67", "Day 68", "Day 69", "Day 70", "Day 71", "Day 72", "Day 73", "Day 74", "Day 75", "Day 76", "Day 77", "Day 78", "Day 79", "Day 80", "Day 81", "Day 82", "Day 83", "Day 84", "Day 85", "Day 86", "Day 87", "Day 88", "Day 89", "Day 90", "Day 91", "Day 92", "Day 93", "Day 94", "Day 95", "Day 96", "Day 97", "Day 98", "Day 99", "Day 100"],
    "datasets": [
      {
        "label": "Stock Price",
        "data": [
          45.23, 45.62, 45.89, 46.01, 45.88, 46.13, 46.57, 46.98, 47.12, 47.43,
          47.98, 47.56, 47.89, 48.01, 48.25, 48.70, 49.12, 49.45, 49.78, 50.23,
          50.56, 50.91, 51.23, 51.78, 52.01, 52.45, 52.89, 53.12, 53.67, 54.01,
          53.78, 53.56, 53.23, 52.98, 53.12, 53.45, 53.89, 54.12, 54.56, 54.98,
          55.23, 55.67, 56.01, 56.45, 56.23, 56.78, 57.12, 57.45, 57.89, 58.12,
          57.89, 57.45, 57.12, 56.89, 57.12, 57.45, 57.78, 58.01, 58.56, 58.98,
          59.12, 59.45, 59.89, 60.12, 60.45, 60.78, 61.23, 61.56, 61.89, 62.12,
          62.45, 62.98, 63.12, 63.45, 63.78, 64.12, 64.56, 64.89, 65.12, 65.45,
          65.89, 66.12, 66.45, 66.98, 67.23, 67.56, 67.89, 68.12, 68.45, 68.89,
          69.12, 69.45, 69.78, 70.12, 70.45, 70.89, 71.23, 71.56, 71.98, 72.12
        ],
        "borderWidth": 1,
        "pointRadius": 1,
        "tension": 0.2,
        "fill": true
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "title": {
          "display": true,
          "text": "Price ($)"
        }
      },
      "x": {
        "ticks": {
          "autoSkip": true,
          "maxTicksLimit": 10
        },
        "title": {
          "display": true,
          "text": "Trading Day"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Stock Price Over 100 Days"
      }
    }
  }
}
```

## 6. Scatter Plot for Correlation Analysis

A scatter plot to test the correlation detection capabilities.

```chart
{
  "type": "scatter",
  "data": {
    "datasets": [
      {
        "label": "Height vs. Weight",
        "data": [
          { "x": 155, "y": 50 }, { "x": 158, "y": 52 }, { "x": 161, "y": 54 },
          { "x": 163, "y": 59 }, { "x": 165, "y": 63 }, { "x": 168, "y": 65 },
          { "x": 170, "y": 67 }, { "x": 173, "y": 70 }, { "x": 175, "y": 72 },
          { "x": 178, "y": 75 }, { "x": 180, "y": 78 }, { "x": 183, "y": 80 },
          { "x": 185, "y": 83 }, { "x": 188, "y": 85 }, { "x": 190, "y": 87 },
          { "x": 193, "y": 90 }, { "x": 195, "y": 93 }, { "x": 166, "y": 69 },
          { "x": 171, "y": 73 }, { "x": 176, "y": 75 }, { "x": 181, "y": 79 },
          { "x": 186, "y": 84 }, { "x": 157, "y": 56 }, { "x": 167, "y": 62 },
          { "x": 174, "y": 68 }, { "x": 182, "y": 76 }, { "x": 162, "y": 58 },
          { "x": 172, "y": 69 }, { "x": 177, "y": 74 }, { "x": 184, "y": 82 }
        ],
        "pointRadius": 6,
        "pointHoverRadius": 8
      }
    ]
  },
  "options": {
    "scales": {
      "x": {
        "title": {
          "display": true,
          "text": "Height (cm)"
        }
      },
      "y": {
        "title": {
          "display": true,
          "text": "Weight (kg)"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Height vs. Weight Correlation"
      }
    }
  }
}
```

## 7. Mixed Chart with Regression Analysis Potential

This mixed chart combines a bar chart with a line to test regression analysis capabilities.

```chart
{
  "type": "bar",
  "data": {
    "labels": ["2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"],
    "datasets": [
      {
        "label": "Annual Rainfall",
        "data": [825, 728, 904, 915, 850, 920, 980, 1050, 985, 1100, 1150, 1180, 1250, 1310]
      },
      {
        "label": "Crop Yield",
        "data": [60, 57, 68, 71, 66, 70, 72, 76, 73, 79, 82, 84, 88, 92],
        "type": "line",
        "yAxisID": "y2",
        "borderWidth": 2,
        "tension": 0.4,
        "fill": false
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "position": "left",
        "title": {
          "display": true,
          "text": "Rainfall (mm)"
        }
      },
      "y2": {
        "beginAtZero": true,
        "position": "right",
        "grid": {
          "drawOnChartArea": false
        },
        "title": {
          "display": true,
          "text": "Crop Yield (tons/hectare)"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Year"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Relationship Between Rainfall and Crop Yield"
      }
    }
  }
}
```

## 8. Complex Cyclical Pattern Detection

This chart shows multiple cycles of different lengths for testing cycle detection.

```chart
{
  "type": "line",
  "data": {
    "labels": ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6", "Month 7", "Month 8", "Month 9", "Month 10", "Month 11", "Month 12", "Month 13", "Month 14", "Month 15", "Month 16", "Month 17", "Month 18", "Month 19", "Month 20", "Month 21", "Month 22", "Month 23", "Month 24", "Month 25", "Month 26", "Month 27", "Month 28", "Month 29", "Month 30", "Month 31", "Month 32", "Month 33", "Month 34", "Month 35", "Month 36", "Month 37", "Month 38", "Month 39", "Month 40", "Month 41", "Month 42", "Month 43", "Month 44", "Month 45", "Month 46", "Month 47", "Month 48"],
    "datasets": [
      {
        "label": "Product A Demand",
        "data": [
          30, 35, 45, 40, 30, 25, 32, 35, 45, 55, 60, 50,
          35, 40, 50, 45, 35, 30, 37, 40, 50, 60, 65, 55,
          40, 45, 55, 50, 40, 35, 42, 45, 55, 65, 70, 60,
          45, 50, 60, 55, 45, 40, 47, 50, 60, 70, 75, 65
        ],
        "borderWidth": 2,
        "tension": 0.3,
        "fill": true
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Units (thousands)"
        }
      },
      "x": {
        "ticks": {
          "autoSkip": true,
          "maxTicksLimit": 12
        },
        "title": {
          "display": true,
          "text": "Month"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Cyclical Demand Pattern (4 Years)"
      },
      "subtitle": {
        "display": true,
        "text": "Shows yearly cycles with upward trend"
      }
    }
  }
}
```

## 9. Chart with Custom Descriptions

This chart includes custom descriptions to test how the system handles user-provided accessibility information.

```chart
{
  "type": "line",
  "data": {
    "labels": ["2018", "2019", "2020", "2021", "2022", "2023"],
    "datasets": [
      {
        "label": "Renewable Energy Production",
        "data": [120, 150, 180, 250, 300, 380],
        "borderWidth": 2,
        "tension": 0.4,
        "fill": true
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Energy (TWh)"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Year"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Renewable Energy Growth"
      }
    }
  },
  "descriptions": {
    "short": "A line chart showing the rapid growth of renewable energy production from 2018 to 2023, with production more than tripling over this period.",
    "detailed": "<p>This line chart displays the growth in renewable energy production measured in terawatt-hours (TWh) over a six-year period from 2018 to 2023.</p><p>The chart shows a consistent upward trend with accelerating growth. Starting at 120 TWh in 2018, production increased steadily each year, with the most significant jumps occurring between 2020-2021 and 2022-2023. By 2023, production reached 380 TWh, representing a 217% increase from the 2018 baseline.</p><p>This acceleration reflects increased investment in renewable infrastructure and supportive policy environments globally.</p>"
  }
}
```

## 10. Statistical Distribution Test

This chart is designed to test the statistical distribution analysis features.

```chart
{
  "type": "bar",
  "data": {
    "labels": ["0-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "91-100"],
    "datasets": [
      {
        "label": "Test Score Distribution",
        "data": [5, 8, 12, 20, 35, 42, 30, 18, 10, 3],
        "borderWidth": 1
      }
    ]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Number of Students"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Score Range"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Test Score Distribution"
      }
    }
  }
}
```

These test charts cover various scenarios that will help evaluate the advanced analysis capabilities of your enhanced chart accessibility system. Each chart is designed to highlight different statistical features and patterns that should be detected by the advanced modules. The color details have been removed to allow your default palette settings to be applied.
