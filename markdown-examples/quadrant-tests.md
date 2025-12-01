```mermaid
quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    Campaign A: [0.3, 0.6]
    Campaign B: [0.45, 0.23]
    Campaign C: [0.57, 0.69]
    Campaign D: [0.78, 0.34]
```

# Quadrant Chart Edge Case Testing Guide

Here are detailed test cases for the edge cases in the quadrant chart accessibility module, with expected results for each one.

## 1. Empty Charts Test

This tests how the module handles quadrant charts with no data points.

### Test Example:

```mermaid
quadrantChart
    title Empty Quadrant Matrix
    x-axis Low Priority --> High Priority
    y-axis Low Complexity --> High Complexity
    quadrant-1 Quick Wins
    quadrant-2 Major Projects
    quadrant-3 Time Wasters
    quadrant-4 Fill-ins
```

### Expected Results:

**Short Description should:**

- Mention it's a quadrant chart with the title "Empty Quadrant Matrix"
- Include the axis labels ("Low Priority to High Priority" and "Low Complexity to High Complexity")
- Not mention any points or point distribution
- Example: "A quadrant chart titled 'Empty Quadrant Matrix' showing the relationship between Low Priority to High Priority and Low Complexity to High Complexity. Contains 0 data points."

**Detailed Description should:**

- Include all quadrant labels in the Framework section
- Explicitly state "This chart contains no data points" in the Distribution section
- Not include the Points section at all (since there are no points to describe)
- Show all sections (Overview, Framework, Distribution, Visual Note) except the Points section

## 2. Missing Labels Tests

### 2.2 Missing Quadrant Labels

```mermaid
quadrantChart
    title Missing Quadrant Labels
    x-axis Low Revenue --> High Revenue
    y-axis Low Growth --> High Growth
    quadrant-1 Stars
    quadrant-3 Dogs
    Item X: [0.3, 0.8]
    Item Y: [0.7, 0.2]
```

### Expected Results:

**Short Description should:**

- Mention the complete axis labels
- Not specifically mention missing quadrant labels

**Detailed Description should:**

- List "Quadrant 2 (top-left): Unlabelled" in the framework section
- List "Quadrant 4 (bottom-right): Unlabelled" in the framework section
- When describing points in unlabelled quadrants, use the position description instead of the label

## 3. Point Styling Tests

### 3.1 Direct Styling

```mermaid
quadrantChart
    title Point Styling Test
    x-axis Less --> More
    y-axis Worse --> Better
    quadrant-1 Best
    quadrant-2 Improve
    quadrant-3 Ignore
    quadrant-4 Maintain
    Critical Item: [0.2, 0.9] radius: 15, color: #ff0000
    Standard Item: [0.5, 0.5]
    Minor Item: [0.8, 0.3] radius: 5, color: #aaaaaa
```

### Expected Results:

**Short Description should:**

- Not mention styling information (keeping it concise)

**Detailed Description should:**

- Include a note in the Visual Representation section like: "Some points have custom visual styling that may indicate different categories or importance."
- Not excessively detail the styling attributes as they're visual and not essential for understanding the content
- Still correctly identify the quadrant for each point regardless of styling

### 3.2 Class-based Styling

```mermaid
quadrantChart
    title Classification Using Styling
    x-axis Low Risk --> High Risk
    y-axis Low Reward --> High Reward
    quadrant-1 High Reward, High Risk
    quadrant-2 High Reward, Low Risk
    quadrant-3 Low Reward, Low Risk
    quadrant-4 Low Reward, High Risk
    Investment A:::critical: [0.8, 0.9]
    Investment B:::moderate: [0.4, 0.8]
    Investment C:::safe: [0.3, 0.3]
    Investment D:::moderate: [0.7, 0.4]
    classDef critical color: #ff0000, radius: 12
    classDef moderate color: #ffaa00, radius: 8
    classDef safe color: #00aa00, radius: 6
```

### Expected Results:

**Short Description should:**

- Focus on the distribution of points across quadrants, not the styling

**Detailed Description should:**

- Include the styling note in the Visual Representation section
- Properly handle the class attribution when parsing
- Not let the styling information distract from the primary content analysis
- Correctly determine point quadrants regardless of styling

## 4. Complex Distribution Test

```mermaid
quadrantChart
    title Skewed Distribution
    x-axis Poor --> Excellent
    y-axis Low --> High
    quadrant-1 Exceptional Cases
    quadrant-2 Above Average
    quadrant-3 Below Average
    quadrant-4 Mixed Cases
    Case 1: [0.1, 0.9]
    Case 2: [0.2, 0.85]
    Case 3: [0.15, 0.8]
    Case 4: [0.25, 0.95]
    Case 5: [0.3, 0.75]
    Case 6: [0.1, 0.8]
```

### Expected Results:

**Short Description should:**

- Mention that most points fall in the top-left (quadrant 2) quadrant
- Example: "A quadrant chart titled 'Skewed Distribution' showing the relationship between Poor to Excellent and Low to High. Contains 6 data points, with most falling in the Above Average quadrant (top-left)."

**Detailed Description should:**

- In the Distribution section, show the correct percentage breakdown (all or most points in quadrant 2)
- Note that some quadrants are empty (3 and 4)
- Example in Distribution section: "Note: Quadrants 3, 4 are empty."

## 5. Boundary Case Test

```mermaid
quadrantChart
    title Boundary Cases
    x-axis Minimum --> Maximum
    y-axis Lowest --> Highest
    quadrant-1 Top Right
    quadrant-2 Top Left
    quadrant-3 Bottom Left
    quadrant-4 Bottom Right
    Center: [0.5, 0.5]
    XBoundary: [0.5, 0.7]
    YBoundary: [0.3, 0.5]
    Corner: [0.01, 0.99]
    Extreme: [0.99, 0.01]
```
