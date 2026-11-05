/**
 * Mermaid type primers: "About <type> diagrams"
 *
 * GENERATED from docs/mermaid-type-primers-2026-11-03.md VERSION 1 by
 * .claude/mermaid-harness/scratch/item145-build-1/gen-primers.mjs.
 * NEVER EDIT BY HAND. Change the document, then regenerate; run the
 * generator with --check to prove this file still matches the document.
 *
 * Register item 145. The panel shell reads window.MermaidTypePrimers at
 * call time, keyed by the generator key MERMAID_TYPE_TO_KEY returns.
 */
(function () {
  // Logging configuration (inside module scope)
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Helper functions for logging
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message);
    }
  }

  window.MermaidTypePrimers = Object.freeze({
    "flowchart": {
      summary: "About flowcharts",
      paragraphs: [
        "A flowchart shows steps and the order they happen in. Boxes hold the steps. Arrows connect them and show which step comes next.",
        "Start at the beginning and follow the arrows. The flow may run from top to bottom or from left to right. A diamond is a decision where the flow can take different paths. Words on an arrow tell you when to follow that path.",
        "The description lists every box and its words. It identifies diamonds as decisions and describes every arrow, including where it starts, where it ends, and any words on it. It also groups boxes that appear inside a named area. The description explains the flowchart as shown. It does not add advice or interpretation.",
      ],
    },
    "sequenceDiagram": {
      summary: "About sequence diagrams",
      paragraphs: [
        "A sequence diagram shows who communicates with whom and the order in which things happen. Each person or system has its own column. Time runs from top to bottom, so things near the top happen before things lower down.",
        "Each arrow shows a message from one participant to another. Read the arrows from top to bottom. The direction of the arrow shows who sends the message and who receives it. Different types of lines and arrowheads can show different kinds of messages, such as a request or a reply. A box across several columns can group messages that repeat, happen only in certain circumstances, or represent different choices.",
        "The description names every participant, then describes each message in order, including who sends it, who receives it, and the words on the message. It also describes notes and grouped sections, including what they contain and any conditions or choices shown. The description explains the sequence diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "classDiagram": {
      summary: "About class diagrams",
      paragraphs: [
        "A class diagram shows the different kinds of things in a computer program and how they relate to each other. Each box represents a class: a kind of thing the program works with.",
        "A class box can have up to three parts. The first gives its name. The other parts can show information it holds and things it can do. Lines between boxes show relationships between classes. Different types of lines and arrowheads show different kinds of relationships. For example, a hollow arrow can show that one class is a more specific kind of another.",
        "The description names every class and gives the information and actions shown for it. It then describes each relationship, including the classes it connects and the kind of relationship shown. The description explains the class diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "stateDiagram": {
      summary: "About state diagrams",
      paragraphs: [
        "A state diagram shows the different conditions something can be in and how it can change from one condition to another. Each rounded box represents a state: the condition something is in at that point. A filled dot can show where the process starts.",
        "Start at the filled dot and follow the arrows. Each arrow shows a change from one state to another. Words on an arrow can explain what causes the change or when it happens. A state can contain smaller states when it has several stages of its own.",
        "The description names every state and describes every change in order, including where it starts, where it ends, and any cause or condition shown. It also explains states that contain smaller states. The description explains the state diagram as shown. It does not add advice or interpretation",
      ],
    },
    "entityRelationshipDiagram": {
      summary: "About entity relationship diagrams",
      paragraphs: [
        "An entity relationship diagram shows the kinds of information a database keeps and how they relate to each other. Each box represents a type of record, such as a Customer or an Order.",
        "A box can also list the information stored about that type of record, called fields. Lines between boxes show relationships between record types. Marks at each end of a line show how many records can take part in the relationship, such as one or many, and whether the relationship is optional. Words on the line can explain what the relationship means.",
        "The description names every record type and lists the fields shown for it. It then describes every relationship, including the record types it connects, how many records can take part on each side, whether either side is optional, and any words shown for the relationship. The description explains the entity relationship diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "userJourney": {
      summary: "About user journey diagrams",
      paragraphs: [
        "A user journey shows the steps a person takes to reach a goal and how they feel at each step.",
        "Follow the steps in the order given. In the visual diagram, the steps are arranged from left to right.",
        "Steps can be grouped into named stages. Each step can have a score from one to five showing how the person feels at that point. A face may also show this visually. Names associated with a step show who is involved.",
        "The description names each stage and describes its steps in order. For each step, it gives the person's score and who is involved. The description explains the user journey as shown. It does not add advice or interpretation.",
      ],
    },
    "gantt": {
      summary: "About Gantt charts",
      paragraphs: [
        "A Gantt chart shows tasks and when they are planned to happen. Each task has a start date and an end date, and may be shown as a bar covering that period.",
        "Tasks can be grouped into named sections. The chart arranges dates in time order. The position and length of a task's bar show when it starts, when it ends, and how long it lasts. Colour, pattern or other markers can show information about a task, such as whether it is complete, in progress, or on the critical path. The chart can also mark important dates or milestones.",
        "The description names each section and describes its tasks, including their start and end dates, duration, and any status shown. It also identifies important dates or milestones. The description explains the Gantt chart as shown. It does not add advice or interpretation.",
      ],
    },
    "pieChart": {
      summary: "About pie charts",
      paragraphs: [
        "A pie chart shows how a whole is divided into parts. Each part is represented by a slice. The size of a slice shows its share of the whole, so a larger share is shown by a larger slice.",
        "Each slice has a name and a value. The legend can identify the slices shown in the chart. The slices together represent the whole.",
        "The description names every part and gives its value and share of the whole. It lists the parts from largest to smallest and identifies the largest. The description explains the pie chart as shown. It does not add advice or interpretation.",
      ],
    },
    "quadrantChart": {
      summary: "About quadrant charts",
      paragraphs: [
        "A quadrant chart compares items using two measures at the same time. Each item has a value for each measure. For example, an item might be compared by how difficult it is and how much value it provides.",
        "The chart has two labelled axes, one for each measure. An item's two values determine its position on the chart. The chart is divided into four areas, called quadrants, which can have names that explain what they represent. Each item is usually shown as a point or dot.",
        "The description names both measures and explains the four quadrants. It then describes each item, giving its value for both measures and the quadrant it belongs to. The description explains the quadrant chart as shown. It does not add advice or interpretation.",
      ],
    },
    "requirement": {
      summary: "About requirement diagrams",
      paragraphs: [
        "A requirement diagram shows what a system needs to do and how parts of the system relate to those needs. A requirement describes something the system must do or achieve. An element represents a part of the system.",
        "Each requirement can include information such as its name, what is required, its level of risk, and how it will be checked. Relationships connect requirements and elements. Words on a relationship explain what the connection means, such as whether an element satisfies or verifies a requirement, or whether one requirement refines another.",
        "The description names every requirement and gives all the information shown for it. It also names each element and describes every relationship, including what it connects and the type of relationship. An overview gives the number of requirements and elements, and a summary gives the risk levels, how each is checked, and the kinds of relationship shown. The description explains the requirement diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "gitGraph": {
      summary: "About Git graphs",
      paragraphs: [
        "A Git graph shows the history of changes to a set of files. Each saved change is called a commit and is usually shown as a point on the graph.",
        "Commits are connected in the order they belong to the history. A branch is a named line of work that can develop separately from other work. Branches can later be brought together in a merge. The lines between commits show how the commits and branches are connected.",
        "The description names each branch and describes its commits in order. For each commit, it gives the information shown in the diagram and explains which branch it belongs to. It also describes where branches merge. The description explains the Git graph as shown. It does not add advice or interpretation.",
      ],
    },
    "c4": {
      summary: "About C4 diagrams",
      paragraphs: [
        "A C4 diagram shows the people and software involved in a system and how they relate to each other. It can show the whole system or focus on the smaller parts inside it.",
        "The diagram can include people, software systems, containers and components. Containers and components represent different levels of detail within a software system. Elements can be grouped inside named boundaries to show that they belong together. Relationships connect elements and can describe what they communicate, the direction of the communication, and how they communicate.",
        "The description names every element and explains what kind of element it is and what it does. It describes each named group and the elements it contains. It also describes every relationship, including what it connects, the direction of the relationship, and any words or technology shown. The description explains the C4 diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "mindmap": {
      summary: "About mind maps",
      paragraphs: [
        "A mind map shows how ideas relate to one main idea. It starts with the main idea and divides it into related topics and smaller subtopics.",
        "The main idea is the starting point of the mind map. Branches connect it to related topics. These branches can divide again to show more detailed ideas. Each level shows how an idea belongs to or develops from the level before it.",
        "The description gives the main idea first. It then describes each topic and its subtopics, level by level, so that the relationship between the ideas is clear. The description explains the mind map as shown. It does not add advice or interpretation.",
      ],
    },
    "timeline": {
      summary: "About timelines",
      paragraphs: [
        "A timeline shows events in chronological order, from earlier events to later ones. Each event is linked to a date or period of time.",
        "A date or period can have one or more events associated with it. Events can also be grouped into named sections to show that they belong together.",
        "The description names each section and describes its events in chronological order. It gives the date or period associated with each event and includes the information shown for it. The description explains the timeline as shown. It does not add advice or interpretation.",
      ],
    },
    "sankey": {
      summary: "About Sankey diagrams",
      paragraphs: [
        "A Sankey diagram shows how amounts move between different sources and destinations. For example, it can show how energy moves from where it comes from to where it is used.",
        "Each source or destination is connected by flows. Each flow has an amount, and a larger amount is shown by a wider band. A flow can pass through several stages before reaching its final destination.",
        "The description identifies each source and destination and describes every flow, including where it comes from, where it goes, and its amount. It also gives the totals shown for each source or destination. The description explains the Sankey diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "xychart": {
      summary: "About XY charts",
      paragraphs: [
        "An XY chart compares values across categories or points. It can show the values using bars, lines, or both.",
        "The chart has two axes. One represents the categories or points being compared, and the other represents their values. Each bar or point on a line represents a value. When the chart shows more than one set of values, called a series, a legend can identify each series.",
        "The description names both axes and each series. It gives the value for every category or point and identifies the highest and lowest values. The description explains the XY chart as shown. It does not add advice or interpretation.",
      ],
    },
    "block": {
      summary: "About block diagrams",
      paragraphs: [
        "A block diagram shows the parts of a system and how they connect or work together. Each block represents a part of the system.",
        "Blocks can contain smaller blocks to show that those parts belong together. Connections between blocks show how the parts relate. Arrows can show the direction of a connection or flow. The way blocks are arranged can help organise the diagram, but their connections show how the parts relate.",
        "The description names every block and describes any smaller blocks it contains. It then describes every connection, including the blocks it connects, its direction, and any words shown for it. The description explains the block diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "packet": {
      summary: "About packet diagrams",
      paragraphs: [
        "A packet diagram shows how data is organised inside a network message. The data is divided into fields, with each field using a set number of bits.",
        "Each field has a name and occupies a particular range of bits. The fields appear in the order they occur in the message. Their size can also be shown by the amount of space they take up in the diagram. The diagram can divide the data into rows to make the packet easier to display.",
        "The description lists every field in order, including its name, start bit, end bit, and size. A summary gives the overall information about the packet shown in the diagram. The description explains the packet diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "kanban": {
      summary: "About kanban boards",
      paragraphs: [
        "A Kanban board shows work items and the stage of work each one has reached. Each work item is represented by a card. Stages can include things such as To do, Doing and Done.",
        "Work is grouped by stage, with each stage usually shown as a column. A card can include details such as the work item's name, ticket number, who is responsible for it, and its priority. The position of a card within a stage may show its order or priority when the board uses position in this way.",
        "The description names each stage and lists the work items in it. For each work item, it gives the details shown, including who is responsible, its ticket number, and its priority where these are provided. If the order of work items has meaning, the description preserves that order. The description explains the Kanban board as shown. It does not add advice or interpretation.",
      ],
    },
    "architecture-beta": {
      summary: "About architecture diagrams",
      paragraphs: [
        "An architecture diagram shows the parts or services that make up a system and how they work together. These might include things such as a web server, an application, or a database.",
        "Each service is represented by an element in the diagram. Services can be grouped to show that they belong together or are part of the same area of the system. Connections between services show how they relate or communicate. A connection can also show its direction and include words that explain what is communicated or how the connection works.",
        "The description names every service and describes any groups they belong to. It then describes every connection, including the services it connects, its direction, and any words or other information shown for it. The description explains the architecture diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "radar": {
      summary: "About radar charts",
      paragraphs: [
        "A radar chart compares one or more things using the same set of measures. This can make it easier to compare their values across several measures at once.",
        "Each measure has its own scale. Each thing being compared has a value for every measure. These values are shown as points joined together to make a shape, sometimes making the chart look like a spider's web. Higher values are shown further along each scale.",
        "The description names every measure and each thing being compared. It gives the value for every measure and identifies the highest and lowest values for each thing. The description explains the radar chart as shown. It does not add advice or interpretation.",
      ],
    },
    "info": {
      summary: "About info diagrams",
      paragraphs: [
        "An info diagram shows which version of Mermaid drew the diagram, and nothing else.",
        "The picture is one line of text with the version number.",
        "The description gives the version number as drawn.",
      ],
    },
    "treemap": {
      summary: "About treemaps",
      paragraphs: [
        "A treemap shows how a total is divided between groups and the items within them. Each item has a value, and items can belong to a group.",
        "Each item is represented by an area in the chart. A larger value is shown by a larger area. Items that belong to the same group are shown together within a larger area representing that group.",
        "The description names each group and the items that belong to it. It gives the value of each item and the total for each group, and identifies the largest item. The description explains the treemap as shown. It does not add advice or interpretation.",
      ],
    },
    "venn": {
      summary: "About Venn diagrams",
      paragraphs: [
        "A Venn diagram shows how groups of things relate to each other and what they have in common. Each group is called a set.",
        "Each set contains the items that belong to it and is shown as a circle. An item can belong to one set or to more than one set. When an item belongs to more than one set, it appears in the overlapping area of those sets.",
        "The description names every set and lists the items that belong only to that set. It then describes each overlap and lists the items shared by those sets. A summary gives the main totals shown in the diagram. The description explains the Venn diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "treeView": {
      summary: "About tree view diagrams",
      paragraphs: [
        "A tree view shows information arranged in levels. It can show files and folders, or any other information where items belong inside or underneath other items.",
        "An item can contain other items. An item that contains something is called a parent, and the items it contains are its children. These relationships can continue through several levels. The visual layout uses indentation to help show these levels.",
        "The description names every item and explains which items belong within others, level by level. It preserves the order shown and states how many levels the tree contains. The description explains the tree view as shown. It does not add advice or interpretation.",
      ],
    },
    "ishikawa": {
      summary: "About Ishikawa diagrams",
      paragraphs: [
        "An Ishikawa diagram, also called a fishbone diagram, shows possible causes of a problem. It groups the possible causes into categories to help show how they relate to the problem.",
        "The problem is the main focus of the diagram. Each category groups related possible causes. A cause can also have more detailed causes linked to it, creating several levels. These relationships are arranged visually in a shape that resembles the bones of a fish.",
        "The description names the problem first. It then describes each category and the possible causes that belong to it, level by level. The description explains the Ishikawa diagram as shown. It does not add advice or interpretation.",
      ],
    },
    "wardley": {
      summary: "About Wardley maps",
      paragraphs: [
        "A Wardley map shows the parts of a business, service, or system and how they relate to each other. Each part, called a component, is shown by how visible it is to the user and how developed or established it is.",
        "Each component has a level of visibility and a stage of evolution. Evolution can range from something new and uncertain to something standard and widely available. Components can depend on other components, and these dependencies are shown as connections. The map can also show that a component is expected to change its stage of evolution.",
        "The description names every component and gives its visibility and stage of evolution. It then describes each dependency, including which components are linked to which, and any expected changes in evolution. The description explains the Wardley map as shown. It does not add advice or interpretation.",
      ],
    },
    "cynefin": {
      summary: "About Cynefin framework diagrams",
      paragraphs: [
        "A Cynefin diagram groups situations into five domains: Clear, Complicated, Complex, Chaotic and Confusion. Each domain represents a different kind of situation and can include guidance about how to respond to it.",
        "Situations are placed in the domain that represents them. A situation can move from one domain to another, and the diagram can show this change. The boundary between Clear and Chaotic can be marked as the cliff, showing a particular relationship between those two domains.",
        "The description names each domain and lists the situations shown within it. It describes any movement from one domain to another and includes any guidance written in the diagram. It also identifies the boundary marked as the cliff. It also gives the one reason the picture is read with: why the cliff is called the cliff. The description explains the Cynefin diagram as shown. It does not add advice or interpretation.",
      ],
    },
  });

  logInfo("[Mermaid Accessibility] Type primers loaded: 28 keys");
})();
