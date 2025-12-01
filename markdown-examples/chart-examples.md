# Chart.js Examples for Palette Testing

Below you'll find a variety of Chart.js examples with colour definitions removed to better test our palette system. These examples cover different chart types with varying complexity to ensure our controls work as expected.

[[toc]]

## Basic Line Chart

A simple line chart with a single dataset:

```chart
{
  "type": "line",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June", "July"],
    "datasets": [{
      "label": "Monthly Sales",
      "data": [65, 59, 80, 81, 56, 55, 40],
      "fill": false,
      "tension": 0.1
    }]
  }
}
```

## Multi-Series Line Chart

A more complex line chart with multiple datasets:

```chart
{
  "type": "line",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June"],
    "datasets": [
      {
        "label": "2022 Sales",
        "data": [65, 59, 80, 81, 56, 55],
        "fill": false,
        "tension": 0.1
      },
      {
        "label": "2023 Sales",
        "data": [28, 48, 40, 19, 86, 27],
        "fill": false,
        "tension": 0.1
      },
      {
        "label": "2024 Sales",
        "data": [45, 25, 72, 35, 68, 54],
        "fill": false,
        "tension": 0.1
      }
    ]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Quarterly Sales Comparison"
      },
      "tooltip": {
        "mode": "index",
        "intersect": false
      }
    },
    "scales": {
      "y": {
        "title": {
          "display": true,
          "text": "Value (thousands)"
        },
        "min": 0
      },
      "x": {
        "title": {
          "display": true,
          "text": "Month"
        }
      }
    }
  }
}
```

## Stepped Line Chart

A line chart with stepped segments instead of straight lines:

```chart
{
  "type": "line",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June", "July"],
    "datasets": [{
      "label": "Stepped Growth",
      "data": [65, 59, 80, 81, 56, 55, 40],
      "fill": false,
      "stepped": true
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Stepped Line Chart"
      }
    },
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Value"
        }
      }
    }
  }
}
```

## Line Chart with Point Styles

A line chart showing different point style options:

```chart
{
  "type": "line",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June"],
    "datasets": [
      {
        "label": "Circle Points",
        "data": [12, 19, 13, 15, 12, 14],
        "pointStyle": "circle",
        "pointRadius": 6,
        "fill": false
      },
      {
        "label": "Triangle Points",
        "data": [8, 15, 17, 13, 17, 20],
        "pointStyle": "triangle",
        "pointRadius": 6,
        "fill": false
      },
      {
        "label": "Star Points",
        "data": [6, 9, 14, 11, 16, 19],
        "pointStyle": "star",
        "pointRadius": 6,
        "fill": false
      }
    ]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Line Chart with Different Point Styles"
      }
    },
    "responsive": true,
    "scales": {
      "y": {
        "beginAtZero": true
      }
    }
  }
}
```

## Stacked Line Chart

A line chart with stacked areas:

```chart
{
  "type": "line",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June"],
    "datasets": [
      {
        "label": "Team A",
        "data": [12, 19, 13, 15, 12, 14],
        "fill": true
      },
      {
        "label": "Team B",
        "data": [8, 15, 17, 13, 17, 20],
        "fill": true
      },
      {
        "label": "Team C",
        "data": [6, 9, 14, 11, 16, 19],
        "fill": true
      }
    ]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Stacked Line Chart"
      }
    },
    "responsive": true,
    "scales": {
      "y": {
        "stacked": true,
        "beginAtZero": true
      }
    }
  }
}
```

## Bar Chart

A basic bar chart to test palette changes:

```chart
{
  "type": "bar",
  "data": {
    "labels": ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
    "datasets": [{
      "label": "Product Ratings",
      "data": [12, 19, 3, 5, 2, 3],
      "borderWidth": 1
    }]
  },
  "options": {
    "scales": {
      "y": {
        "beginAtZero": true
      }
    }
  }
}
```

## Horizontal Bar Chart

A horizontal bar chart for testing direction-specific features:

```chart
{
  "type": "bar",
  "data": {
    "labels": ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
    "datasets": [
      {
        "label": "My First Dataset",
        "data": [65, 59, 80, 81, 56, 55, 40],
        "borderWidth": 1
      },
      {
        "label": "My Second Dataset",
        "data": [28, 48, 40, 19, 86, 27, 90],
        "borderWidth": 1
      }
    ]
  },
  "options": {
    "indexAxis": "y",
    "scales": {
      "x": {
        "beginAtZero": true
      }
    }
  }
}
```

## Stacked Bar Chart

A stacked bar chart to test complex palette application:

```chart
{
  "type": "bar",
  "data": {
    "labels": ["January", "February", "March", "April", "May"],
    "datasets": [
      {
        "label": "Product A",
        "data": [12, 19, 3, 5, 2],
        "borderWidth": 1
      },
      {
        "label": "Product B",
        "data": [8, 12, 6, 7, 4],
        "borderWidth": 1
      },
      {
        "label": "Product C",
        "data": [5, 9, 13, 8, 10],
        "borderWidth": 1
      }
    ]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Stacked Bar Chart"
      }
    },
    "responsive": true,
    "scales": {
      "x": {
        "stacked": true
      },
      "y": {
        "stacked": true
      }
    }
  }
}
```

## Grouped Bar Chart

A grouped bar chart (non-stacked):

```chart
{
  "type": "bar",
  "data": {
    "labels": ["January", "February", "March", "April", "May"],
    "datasets": [
      {
        "label": "London Store",
        "data": [12, 19, 13, 15, 12],
        "borderWidth": 1
      },
      {
        "label": "Manchester Store",
        "data": [8, 15, 17, 13, 17],
        "borderWidth": 1
      },
      {
        "label": "Edinburgh Store",
        "data": [6, 9, 14, 11, 16],
        "borderWidth": 1
      }
    ]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Store Sales Comparison (Grouped)"
      }
    },
    "responsive": true,
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Sales (£000s)"
        }
      }
    }
  }
}
```

## Horizontal Stacked Bar Chart

A horizontal bar chart with stacked values:

```chart
{
  "type": "bar",
  "data": {
    "labels": ["Team A", "Team B", "Team C", "Team D", "Team E"],
    "datasets": [
      {
        "label": "Q1 Performance",
        "data": [12, 19, 13, 15, 12],
        "borderWidth": 1
      },
      {
        "label": "Q2 Performance",
        "data": [8, 15, 17, 13, 17],
        "borderWidth": 1
      },
      {
        "label": "Q3 Performance",
        "data": [6, 9, 14, 11, 16],
        "borderWidth": 1
      }
    ]
  },
  "options": {
    "indexAxis": "y",
    "plugins": {
      "title": {
        "display": true,
        "text": "Horizontal Stacked Bar Chart"
      }
    },
    "responsive": true,
    "scales": {
      "x": {
        "stacked": true,
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Performance Score"
        }
      },
      "y": {
        "stacked": true,
        "title": {
          "display": true,
          "text": "Team"
        }
      }
    }
  }
}
```

## Pie Chart

A pie chart to test circular chart controls:

```chart
{
  "type": "pie",
  "data": {
    "labels": ["Direct", "Organic Search", "Referral", "Social Media", "Email", "Other"],
    "datasets": [{
      "label": "Website Traffic Sources",
      "data": [30.1, 44.3, 10.2, 8.7, 5.4, 1.3],
      "borderWidth": 1
    }]
  },
  "options": {
    "plugins": {
      "legend": {
        "position": "right"
      },
      "title": {
        "display": true,
        "text": "Website Traffic Sources"
      }
    }
  }
}
```

## Doughnut Chart

A doughnut chart variation:

```chart
{
  "type": "doughnut",
  "data": {
    "labels": ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
    "datasets": [{
      "label": "Colour Preference Survey",
      "data": [12, 19, 3, 5, 2, 3],
      "borderWidth": 1,
      "cutout": "70%"
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "legend": {
        "position": "top"
      },
      "title": {
        "display": true,
        "text": "Doughnut Chart"
      }
    }
  }
}
```

## Polar Area Chart

A polar area chart for testing another circular format:

```chart
{
  "type": "polarArea",
  "data": {
    "labels": ["Red", "Blue", "Yellow", "Green", "Purple"],
    "datasets": [{
      "label": "Dataset 1",
      "data": [11, 16, 7, 14, 9],
      "borderWidth": 1
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "legend": {
        "position": "right"
      },
      "title": {
        "display": true,
        "text": "Polar Area Chart"
      }
    }
  }
}
```

## Radar Chart

A radar chart for testing another specialized format:

```chart
{
  "type": "radar",
  "data": {
    "labels": ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
    "datasets": [{
      "label": "My First Dataset",
      "data": [65, 59, 90, 81, 56, 55, 40],
      "fill": true,
      "pointBorderColor": "#fff",
      "pointHoverBackgroundColor": "#fff"
    }, {
      "label": "My Second Dataset",
      "data": [28, 48, 40, 19, 96, 27, 100],
      "fill": true,
      "pointBorderColor": "#fff",
      "pointHoverBackgroundColor": "#fff"
    }]
  },
  "options": {
    "elements": {
      "line": {
        "borderWidth": 3
      }
    }
  }
}
```

## Bubble Chart

A bubble chart with variable point sizes:

```chart
{
  "type": "bubble",
  "data": {
    "datasets": [
      {
        "label": "First Dataset",
        "data": [
          { "x": 20, "y": 30, "r": 15 },
          { "x": 40, "y": 10, "r": 10 },
          { "x": 30, "y": 25, "r": 25 },
          { "x": 10, "y": 15, "r": 5 },
          { "x": 50, "y": 45, "r": 20 }
        ]
      },
      {
        "label": "Second Dataset",
        "data": [
          { "x": 15, "y": 40, "r": 12 },
          { "x": 35, "y": 20, "r": 8 },
          { "x": 25, "y": 15, "r": 18 },
          { "x": 45, "y": 30, "r": 22 },
          { "x": 5, "y": 10, "r": 15 }
        ]
      }
    ]
  },
  "options": {
    "responsive": true,
    "scales": {
      "x": {
        "title": {
          "display": true,
          "text": "X Axis"
        }
      },
      "y": {
        "title": {
          "display": true,
          "text": "Y Axis"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Bubble Chart Example"
      }
    }
  }
}
```

## Scatter Chart

A scatter chart for testing point-based charts:

```chart
{
  "type": "scatter",
  "data": {
    "datasets": [
      {
        "label": "A Dataset",
        "data": [
          { "x": -10, "y": 0 },
          { "x": 0, "y": 10 },
          { "x": 10, "y": 5 },
          { "x": 0.5, "y": 5.5 },
          { "x": -5, "y": -5 },
          { "x": 7, "y": -10 }
        ]
      },
      {
        "label": "B Dataset",
        "data": [
          { "x": -3, "y": 3 },
          { "x": 4, "y": 4 },
          { "x": 1.5, "y": 2.5 },
          { "x": -6, "y": 9 },
          { "x": 8, "y": -7 },
          { "x": -8, "y": -2 }
        ]
      }
    ]
  },
  "options": {
    "scales": {
      "x": {
        "title": {
          "display": true,
          "text": "X Value"
        }
      },
      "y": {
        "title": {
          "display": true,
          "text": "Y Value"
        }
      }
    },
    "plugins": {
      "title": {
        "display": true,
        "text": "Scatter Plot"
      }
    }
  }
}
```

## Combo Bar-Line Chart

A specialized mixed chart combining bar and line types:

```chart
{
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June"],
    "datasets": [
      {
        "type": "bar",
        "label": "Monthly Revenue",
        "data": [50, 60, 70, 180, 190, 220],
        "order": 2
      },
      {
        "type": "line",
        "label": "Monthly Profit",
        "data": [20, 25, 30, 60, 65, 90],
        "borderWidth": 2,
        "order": 1
      }
    ]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Revenue vs Profit"
      }
    },
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Amount (£000s)"
        }
      }
    }
  }
}
```

## Mixed Chart Types

A more complex example with multiple chart types:

```chart
{
  "type": "bar",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June", "July"],
    "datasets": [
      {
        "type": "line",
        "label": "Line Dataset",
        "data": [50, 55, 60, 59, 80, 81, 75],
        "fill": false,
        "tension": 0.4,
        "yAxisID": "y"
      },
      {
        "type": "bar",
        "label": "Bar Dataset",
        "data": [25, 30, 35, 40, 45, 50, 55],
        "yAxisID": "y"
      },
      {
        "type": "bar",
        "label": "Bar Dataset 2",
        "data": [10, 15, 20, 25, 30, 35, 40],
        "yAxisID": "y"
      }
    ]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Mixed Chart Types"
      },
      "tooltip": {
        "mode": "index",
        "intersect": false
      }
    },
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Value"
        }
      },
      "x": {
        "title": {
          "display": true,
          "text": "Month"
        }
      }
    }
  }
}
```

## Area Chart with Fill

A line chart with area fill to test how our controls handle fills:

```chart
{
  "type": "line",
  "data": {
    "labels": ["January", "February", "March", "April", "May", "June", "July"],
    "datasets": [
      {
        "label": "Website Traffic",
        "data": [0, 10, 5, 14, 20, 30, 45],
        "fill": true,
        "tension": 0.4
      }
    ]
  },
  "options": {
    "plugins": {
      "title": {
        "display": true,
        "text": "Monthly Website Traffic"
      }
    },
    "scales": {
      "y": {
        "beginAtZero": true,
        "title": {
          "display": true,
          "text": "Visitors (thousands)"
        }
      }
    }
  }
}
```
