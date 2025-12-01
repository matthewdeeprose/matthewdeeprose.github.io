# Mermaid Diagram Test Collection

This collection contains various Mermaid diagrams to test your implementation, ranging from simple to complex and covering different diagram types. Some diagrams support orientation changes, while others demonstrate specific Mermaid features.

## Table of Contents

1. [Basic Flowchart](#basic-flowchart)
2. [Complex Flowchart](#complex-flowchart)
3. [State Diagram](#state-diagram)
4. [Class Diagram](#class-diagram)
5. [Entity Relationship Diagram](#entity-relationship-diagram)
6. [Sequence Diagram](#sequence-diagram)
7. [Gantt Chart](#gantt-chart)
8. [Pie Chart](#pie-chart)
9. [User Journey](#user-journey)
10. [Git Graph](#git-graph)
11. [Mindmap](#mindmap)
12. [Timeline](#timeline)
13. [Quadrant](#quadrant)
14. [Requirement](#Requirement)

## Basic Flowchart

```mermaid
graph TB
    A[Start] --> B{Is it raining?}
    B -->|Yes| C[Take umbrella]
    B -->|No| D[Take sunglasses]
    C --> E[Go out]
    D --> E
    E --> F[Return home]
```

## Complex Flowchart

```mermaid
flowchart TB
    Start --> Process1
    Process1 --> SubprocessA

    subgraph ProcessGroup [Main Process Group]
        direction LR
        SubprocessA --> SubprocessB
        SubprocessB --> SubprocessC
        SubprocessC --> Decision1{Continue?}
        Decision1 -->|Yes| SubprocessB
        Decision1 -->|No| ExitProcess
    end

    subgraph DataFlow [Data Processing]
        direction TB
        InputData[(Database)] --> FilterData
        FilterData --> ProcessData
        ProcessData --> OutputData[(Results)]
    end

    ExitProcess --> DataFlow
    OutputData --> End

    subgraph ErrorHandling [Error Handling]
        Error1[Error Detected] --> LogError
        LogError --> NotifyAdmin
        NotifyAdmin --> AttemptRecovery
        AttemptRecovery --> Decision2{Recoverable?}
        Decision2 -->|Yes| Process1
        Decision2 -->|No| End
    end

    SubprocessA -.-> Error1
    SubprocessC -.-> Error1
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Start
    Processing --> Error: Error occurs
    Processing --> Completed: Success
    Error --> Idle: Reset
    Completed --> Idle: Reset
    Completed --> [*]: Exit
    Error --> [*]: Exit
```

## Class Diagram

```mermaid
classDiagram
    class Person {
        +String name
        +int age
        +getDetails()
    }
    class Employee {
        +int employeeID
        +String department
        +calculateSalary()
    }
    class Manager {
        +String[] team
        +scheduleTeamMeeting()
        +assignTasks()
    }
    class Customer {
        +String customerID
        +String[] purchases
        +getPurchaseHistory()
    }
    Person <|-- Employee
    Person <|-- Customer
    Employee <|-- Manager
    Manager "1" --> "0..*" Employee: manages
    Customer "1" --> "1..*" Employee: contacts
```

## Entity Relationship Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string name
        string email
        string address
        string phone
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        int orderID
        date orderDate
        string status
        float totalAmount
    }
    ORDER_ITEM {
        int orderItemID
        int quantity
        float price
    }
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    PRODUCT {
        int productID
        string name
        string description
        float price
        int stockQuantity
    }
    CATEGORY ||--o{ PRODUCT : contains
    CATEGORY {
        int categoryID
        string name
        string description
    }
```

## Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant Database

    User->>Frontend: Fill in login form
    Frontend->>Frontend: Validate input
    alt Input valid
        Frontend->>API: POST /login
        API->>Database: Query credentials
        Database-->>API: Return result
        alt Credentials valid
            API-->>Frontend: Return auth token
            Frontend-->>User: Show dashboard
        else Credentials invalid
            API-->>Frontend: Return error
            Frontend-->>User: Show error message
        end
    else Input invalid
        Frontend-->>User: Show validation error
    end

    User->>Frontend: Request profile data
    Frontend->>API: GET /profile (with token)
    API->>Database: Query user data
    Database-->>API: Return user data
    API-->>Frontend: Return profile data
    Frontend-->>User: Display profile
```

## Gantt Chart

```mermaid
gantt
    title Website Development Project
    dateFormat  YYYY-MM-DD

    section Planning
    Project kickoff       :a1, 2023-04-01, 3d
    Requirements gathering:a2, after a1, 7d
    Information architecture:a3, after a2, 5d

    section Design
    Wireframes            :b1, after a3, 7d
    Visual design         :b2, after b1, 10d
    Design review         :b3, after b2, 3d

    section Development
    Frontend framework    :c1, after b3, 8d
    Homepage development  :c2, after c1, 5d
    User authentication   :c3, after c1, 7d
    Content pages         :c4, after c2, 10d
    Admin dashboard       :c5, after c3, 8d

    section Testing
    Unit testing          :d1, after c4, 5d
    Integration testing   :d2, after d1, 5d
    User acceptance       :d3, after d2, 7d

    section Deployment
    Server setup          :e1, after c5, 3d
    Deployment preparation:e2, after e1, 2d
    Go live               :milestone, after d3, 0d
```

## Pie Chart

```mermaid
pie title Website Traffic Sources
    "Direct" : 30.1
    "Organic Search" : 44.3
    "Referral" : 10.2
    "Social Media" : 8.7
    "Email" : 5.4
    "Other" : 1.3
```

## User Journey

```mermaid
journey
    title Customer Journey Through E-Commerce Site
    section Homepage
      Visit homepage: 5: User
      Browse featured products: 4: User
      Use search function: 3: User
    section Product Browsing
      View category listings: 5: User
      Use filters: 3: User
      View product details: 5: User
    section Purchase Process
      Add to cart: 5: User
      View cart: 5: User
      Enter shipping info: 3: User
      Enter payment details: 2: User
      Complete purchase: 4: User
    section Post-Purchase
      Receive order confirmation: 5: User
      Track shipment: 4: User
      Receive product: 5: User
      Leave review: 2: User
```

## Git Graph

```mermaid
gitGraph
    commit id: "Initial commit"
    branch develop
    checkout develop
    commit id: "Add feature A structure"
    commit id: "Implement feature A logic"
    branch feature-B
    checkout feature-B
    commit id: "Add feature B"
    commit id: "Fix bug in feature B"
    checkout develop
    merge feature-B
    commit id: "Update tests"
    branch feature-C
    checkout feature-C
    commit id: "Add feature C"
    commit id: "Refine feature C"
    checkout develop
    merge feature-C
    checkout main
    merge develop tag: "v1.0.0"
    branch hotfix
    checkout hotfix
    commit id: "Fix critical issue"
    checkout main
    merge hotfix tag: "v1.0.1"
    checkout develop
    merge main
```

## Mindmap

```mermaid
mindmap
    root((Digital Accessibility))
        Principles
            Perceivable
                ::icon(fa fa-eye)
                Text alternatives
                Time-based media
                Adaptable content
                Distinguishable content
            Operable
                ::icon(fa fa-hand-pointer)
                Keyboard accessible
                Enough time
                Seizures & reactions
                Navigable
                Input modalities
            Understandable
                ::icon(fa fa-lightbulb)
                Readable
                Predictable
                Input assistance
            Robust
                ::icon(fa fa-wrench)
                Compatible
                Compliant

        Testing
            Automated
                ::icon(fa fa-robot)
                Axe
                WAVE
                Lighthouse
            Manual
                ::icon(fa fa-users)
                Keyboard testing
                Screen reader testing
                Color contrast analysis

        Standards
            WCAG
                Level A
                Level AA
                Level AAA
            ARIA
            EN 301 549

        Assistive Technologies
            Screen readers
            Magnifiers
            Voice control
            Switch devices
```

## Timeline

```mermaid
timeline
    title History of Web Accessibility
    section 1990s
        1994 : Creation of the Web Accessibility Initiative (WAI)
        1997 : First draft of WCAG published
        1999 : WCAG 1.0 becomes official W3C Recommendation
    section 2000s
        2000 : Section 508 of the US Rehabilitation Act amended
        2005 : ARIA (Accessible Rich Internet Applications) development begins
        2008 : WCAG 2.0 becomes official W3C Recommendation
    section 2010s
        2012 : W3C and HTML5
        2017 : EN 301 549 European Accessibility requirements
        2018 : WCAG 2.1 becomes official W3C Recommendation
    section 2020s
        2020 : More mobile accessibility focus
        2021 : WCAG 2.2 draft
        2023 : WCAG 2.2 becomes official W3C Recommendation
```

## Accessibility Compliance Flowchart

```mermaid
flowchart LR
    Start([Start Assessment]) --> Audit[Conduct Accessibility Audit]
    Audit --> Issues{Issues Found?}
    Issues -->|No| Compliance[Verify WCAG 2.2 AA Compliance]
    Issues -->|Yes| Priority[Prioritize Issues]
    Priority --> Critical{Critical Issues?}
    Critical -->|Yes| FixCritical[Fix Critical Issues]
    Critical -->|No| Plan[Create Remediation Plan]
    FixCritical --> Plan
    Plan --> Implementation[Implement Fixes]
    Implementation --> Testing[Test with Assistive Technologies]
    Testing --> Validation{All Fixed?}
    Validation -->|No| Implementation
    Validation -->|Yes| Documentation[Document Conformance]
    Documentation --> Training[Train Content Creators]
    Training --> Monitoring[Establish Monitoring Process]
    Compliance --> Documentation
    Monitoring --> End([End Assessment])
```

## Quadrant

```mermaid
quadrantChart
    title LLM Models: Capabilities vs Resource Efficiency
    x-axis Low Parameter Efficiency --> High Parameter Efficiency
    y-axis Basic Capabilities --> Advanced Capabilities
    quadrant-1 Optimal Models
    quadrant-2 Capable but Inefficient
    quadrant-3 Early Development Stage
    quadrant-4 Efficient but Limited
    GPT-4 Turbo: [0.65, 0.92]
    Claude 3 Opus: [0.75, 0.95]
    Gemini Pro: [0.62, 0.88]
    Mistral 7B:::small_model: [0.85, 0.65]
    LLaMA 3 70B:::medium_model: [0.72, 0.78]
    GPT-3.5 Turbo:::medium_model: [0.58, 0.68]
    BERT Large:::legacy_model: [0.25, 0.30]
    Phi-3 Mini:::small_model: [0.88, 0.55]
    PaLM 2:::medium_model: [0.60, 0.75]
    BLOOM 176B:::large_model: [0.30, 0.72]
    Falcon 180B:::large_model: [0.35, 0.80]
    Pythia 12B:::medium_model: [0.45, 0.50]
```

## Requirement

```mermaid
requirementDiagram

requirement test_req {
id: 1
text: the test text.
risk: high
verifymethod: test
}

element test_entity {
type: simulation
}

requirement test_req2 {
id: 2
text: the second test text.
risk: low
verifymethod: inspection
}

test_entity - satisfies -> test_req
test_req - contains -> test_req2
```
