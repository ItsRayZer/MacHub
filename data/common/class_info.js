// Academic Hub & Exam Portal easily-editable sample datasets
// This file serves as the SINGLE, easily-editable database for:
// 1. CLASS TIMETABLES (Monday to Friday, 5 periods for BCA, BBA, BSW)
// 2. ENROLLED SUBJECTS & SYLLABUS MODULES (Credits, type, and syllabus contents)
// 3. FACULTY PROFILES / TEACHERS (Office hours, cabins, designations, and emails)
// 4. EXAM TIMETABLES (Schedules for upcoming final exams)
// 5. EXAM SEATING CHART (Sample seat and desk mappings per register number)

(function () {
    // ==========================================
    // 1. CLASS TIMETABLES (BCA, BBA, BSW)
    // ==========================================
    
    // BCA lecture schedule (Monday to Friday)
    window.CLASS_TIMETABLE_BCA_SEM_4 = window.CLASS_TIMETABLE_BCA = {
        "Monday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG3CCRBCA202", title: "Software Engineering", room: "Room 201" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG3DSEBCA201", title: "Feature Engineering", room: "Room 201" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG3DSEBCA201L", title: "Feature Engineering Lab", room: "Lab 2" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG3CCRBCA201", title: "Database Management Systems", room: "Room 201" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG3CCRBCA200", title: "Quantitative Techniques", room: "Room 201" }
        ],
        "Tuesday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG3CCRBCA200", title: "Quantitative Techniques", room: "Room 201" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG3CCRBCA202", title: "Software Engineering", room: "Room 201" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG3DSEBCA201", title: "Feature Engineering", room: "Room 201" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG3CCRBCA203", title: "Design and Analysis of Algorithms", room: "Room 201" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG3SECBCA200", title: "Python Programming", room: "Room 201" }
        ],
        "Wednesday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG3SECBCA200L", title: "Python Programming Lab", room: "Lab 1" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG3SECBCA200L", title: "Python Programming Lab", room: "Lab 1" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG3CCRBCA203", title: "Design and Analysis of Algorithms", room: "Room 201" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG3CCRBCA202", title: "Software Engineering", room: "Room 201" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG3CCRBCA201", title: "Database Management Systems", room: "Room 201" }
        ],
        "Thursday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG3CCRBCA203", title: "Design and Analysis of Algorithms", room: "Room 201" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG3SECBCA200", title: "Python Programming", room: "Room 201" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG3CCRBCA201", title: "Database Management Systems", room: "Room 201" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG3CCRBCA201", title: "Database Management Systems", room: "Room 201" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG3CCRBCA200", title: "Quantitative Techniques", room: "Room 201" }
        ],
        "Friday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG3CCRBCA201L", title: "Database Management Systems Lab", room: "Lab 2" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG3CCRBCA201L", title: "Database Management Systems Lab", room: "Lab 2" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG3SECBCA200", title: "Python Programming", room: "Room 201" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG3DSEBCA201", title: "Feature Engineering", room: "Room 201" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG3CCRBCA200", title: "Quantitative Techniques", room: "Room 201" }
        ]
    };

    // BBA lecture schedule (Monday to Friday)
    window.CLASS_TIMETABLE_BBA_SEM_2 = window.CLASS_TIMETABLE_BBA = {
        "Monday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2AECENG102", title: "English for Commerce", room: "Room 202" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2MDEBBA100", title: "Media Literacy", room: "Seminar Hall" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" }
        ],
        "Tuesday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2AECENG102", title: "English for Commerce", room: "Room 202" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2MDEBBA100", title: "Media Literacy", room: "Room 202" }
        ],
        "Wednesday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2MDEBBA100", title: "Media Literacy", room: "Room 202" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2AECENG102", title: "English for Commerce", room: "Room 202" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" }
        ],
        "Thursday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2MDEBBA100", title: "Media Literacy", room: "Room 202" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2AECENG102", title: "English for Commerce", room: "Room 202" }
        ],
        "Friday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2MDEBBA100", title: "Media Literacy", room: "Room 202" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2CCRBBA100", title: "Organisation Behaviour", room: "Room 202" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2AECENG102", title: "English for Commerce", room: "Room 202" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2CCRBBA101", title: "Marketing Management", room: "Room 202" }
        ]
    };

    // BSW lecture schedule (Monday to Friday)
    window.CLASS_TIMETABLE_BSW_SEM_2 = window.CLASS_TIMETABLE_BSW = {
        "Monday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2AECENG101", title: "English for Arts & Humanities", room: "Room 304" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" }
        ],
        "Tuesday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2AECENG101", title: "English for Arts & Humanities", room: "Room 304" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" }
        ],
        "Wednesday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2AECENG101", title: "English for Arts & Humanities", room: "Room 304" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" }
        ],
        "Thursday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2AECENG101", title: "English for Arts & Humanities", room: "Room 304" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" }
        ],
        "Friday": [
            { period: "1", time: "09:30 AM - 10:30 AM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "2", time: "10:30 AM - 11:30 AM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" },
            { period: "3", time: "11:30 AM - 12:30 PM", code: "MG2AECENG101", title: "English for Arts & Humanities", room: "Room 304" },
            { period: "4", time: "01:30 PM - 02:30 PM", code: "MG2DSCSWK100", title: "Social Work Profession", room: "Room 304" },
            { period: "5", time: "02:30 PM - 03:30 PM", code: "MG2MDCSWK101", title: "Positive Mental Health", room: "Room 304" }
        ]
    };


    // ==========================================
    // 2. ENROLLED SUBJECTS, SYLLABI, AND TEACHERS
    // ==========================================
    
    // BCA Subjects (Data Structures, Web Tech, Maths II, OS, Constitution)
    window.CLASS_SUBJECTS_BCA = [
        {
            code: "MG3CCRBCA201",
            title: "Database Management Systems",
            type: "Core",
            credits: 5,
            teacher: {
                name: "Dr. Roy Mathew",
                designation: "Assistant Professor & Head",
                email: "roy.mathew@maraugusthinose.edu.in",
                hours: "Mon & Wed, 3:30 PM - 4:30 PM",
                room: "Cabin A-12, Computer Block"
            },
            syllabus: [
                "Module 1: Database System Concepts & Architecture - Schemas, data models, database users and administration.",
                "Module 2: Relational Data Model & SQL - SQL queries, DDL, DML, constraints, joins, views, triggers.",
                "Module 3: Database Design - Functional dependencies, Normalization (1NF, 2NF, 3NF, BCNF).",
                "Module 4: Transaction Processing - Concurrency control, ACID properties, serializability, locking protocols.",
                "Module 5: Storage and Query Optimization - Disk storage, indexing (B-trees, B+-trees), hashing."
            ]
        },
        {
            code: "MG3SECBCA200",
            title: "Python Programming",
            type: "Skill Enhancement",
            credits: 4,
            teacher: {
                name: "Prof. Anjana Krishnan",
                designation: "Senior Lecturer",
                email: "anjana.krishnan@maraugusthinose.edu.in",
                hours: "Tue & Fri, 1:30 PM - 2:30 PM",
                room: "Cabin B-04, IT wing"
            },
            syllabus: [
                "Module 1: Python Basics - Variables, data types, control flow structures, functions, lambdas.",
                "Module 2: Data Structures & OOP - Lists, tuples, dictionaries, sets, classes, inheritance, polymorphism.",
                "Module 3: Exception Handling & File I/O - Try/except blocks, reading and writing files.",
                "Module 4: GUI Programming - Tkinter widgets, layout managers, event-driven interfaces.",
                "Module 5: Data Libraries - Introduction to Numpy, Pandas, and Matplotlib."
            ]
        },
        {
            code: "MG3CCRBCA200",
            title: "Quantitative Techniques",
            type: "Complementary",
            credits: 4,
            teacher: {
                name: "Dr. Thomas George",
                designation: "Associate Professor",
                email: "thomas.george@maraugusthinose.edu.in",
                hours: "Wed & Thu, 2:30 PM - 3:30 PM",
                room: "Cabin C-15, Science Block"
            },
            syllabus: [
                "Module 1: Linear Programming - Formulation, graphical method, simplex method, duality.",
                "Module 2: Transportation & Assignment Problems - Initial basic solution methods, MODI method, Hungarian method.",
                "Module 3: Network Analysis - PERT and CPM, float calculations, critical path identification.",
                "Module 4: Decision Theory - Decision making under uncertainty, decision trees, game theory.",
                "Module 5: Queueing Models - Elements of queueing systems, Single server models (M/M/1)."
            ]
        },
        {
            code: "MG3CCRBCA202",
            title: "Software Engineering",
            type: "Core",
            credits: 3,
            teacher: {
                name: "Prof. Sandeep Nair",
                designation: "Assistant Professor",
                email: "sandeep.nair@maraugusthinose.edu.in",
                hours: "Mon & Fri, 11:30 AM - 12:30 PM",
                room: "Cabin A-08, Computer Block"
            },
            syllabus: [
                "Module 1: Software Process Models - Waterfall, Incremental, Spiral, Agile methodologies (Scrum).",
                "Module 2: Requirements Analysis - SRS document, functional/non-functional requirements.",
                "Module 3: Software Design - Architectural styles, modular design, UML diagrams.",
                "Module 4: Software Testing - White box, black box, unit, integration, system, regression testing.",
                "Module 5: Quality & Maintenance - ISO standards, SEI CMM, maintenance types."
            ]
        },
        {
            code: "MG3CCRBCA203",
            title: "Design and Analysis of Algorithms",
            type: "Core",
            credits: 3,
            teacher: {
                name: "Prof. Jose Joseph",
                designation: "Senior Lecturer",
                email: "jose.joseph@maraugusthinose.edu.in",
                hours: "Mon, 2:30 PM - 3:30 PM",
                room: "Cabin B-10, IT wing"
            },
            syllabus: [
                "Module 1: Algorithm Analysis - Asymptotic notations, time and space complexity, recurrences.",
                "Module 2: Divide and Conquer - Binary search, Merge Sort, Quick Sort analysis.",
                "Module 3: Greedy Method - Knapsack problem, Minimum Spanning Trees (Kruskal/Prim), Dijkstra's algorithm.",
                "Module 4: Dynamic Programming - Multi-stage graphs, All Pairs Shortest Paths, Traveling Salesperson.",
                "Module 5: Backtracking & Branch and Bound - N-Queens problem, Sum of subsets, 0/1 Knapsack."
            ]
        },
        {
            code: "MG3DSEBCA201",
            title: "Feature Engineering",
            type: "Professional Elective I",
            credits: 3,
            teacher: {
                name: "Dr. Roy Mathew",
                designation: "Assistant Professor & Head",
                email: "roy.mathew@maraugusthinose.edu.in",
                hours: "Wed & Fri, 1:30 PM - 2:30 PM",
                room: "Cabin A-12, Computer Block"
            },
            syllabus: [
                "Module 1: Introduction to Data Preprocessing - Handling missing values, outliers, data imputation.",
                "Module 2: Variable Transformations - Log transform, power transform, scaling, standardization.",
                "Module 3: Categorical Encoding - One-hot encoding, label encoding, target encoding.",
                "Module 4: Feature Selection - Filter, wrapper, and embedded methods, correlation analysis.",
                "Module 5: Dimensionality Reduction - Principal Component Analysis (PCA), LDA, t-SNE."
            ]
        },
        {
            code: "MG3SECBCA200L",
            title: "Python Programming Lab",
            type: "Skill Enhancement Lab",
            credits: 2,
            teacher: {
                name: "Prof. Anjana Krishnan",
                designation: "Senior Lecturer",
                email: "anjana.krishnan@maraugusthinose.edu.in",
                hours: "Wed, 9:30 AM - 11:30 AM",
                room: "Lab 1"
            },
            syllabus: [
                "Module 1: Basic Python programs - Control structures, loops, lists, tuples, dictionaries.",
                "Module 2: Object-Oriented Programming - Class, object, constructors, inheritance, method overriding.",
                "Module 3: Exception handling and file operations - custom exceptions, reading/writing text/CSV files.",
                "Module 4: GUI programming - Building desktop forms using Tkinter widgets.",
                "Module 5: Data Analysis Lab - Practical exercises using Numpy, Pandas, and Matplotlib."
            ]
        },
        {
            code: "MG3CCRBCA201L",
            title: "Database Management Systems Lab",
            type: "Core Lab",
            credits: 2,
            teacher: {
                name: "Dr. Roy Mathew",
                designation: "Assistant Professor & Head",
                email: "roy.mathew@maraugusthinose.edu.in",
                hours: "Fri, 9:30 AM - 11:30 AM",
                room: "Lab 2"
            },
            syllabus: [
                "Module 1: DDL commands - CREATE, ALTER, DROP, RENAME tables and constraints.",
                "Module 2: DML commands - INSERT, UPDATE, DELETE queries, SELECT with WHERE, GROUP BY, ORDER BY.",
                "Module 3: Complex Queries - Nested subqueries, joins (inner, outer), set operations, views.",
                "Module 4: PL/SQL Programming - Control structures, cursors, exception handling blocks.",
                "Module 5: Advanced PL/SQL - Writing and executing functions, procedures, and triggers."
            ]
        },
        {
            code: "MG3DSEBCA201L",
            title: "Feature Engineering Lab",
            type: "Elective Lab",
            credits: 2,
            teacher: {
                name: "Dr. Roy Mathew",
                designation: "Assistant Professor & Head",
                email: "roy.mathew@maraugusthinose.edu.in",
                hours: "Mon, 11:30 AM - 12:30 PM",
                room: "Lab 2"
            },
            syllabus: [
                "Module 1: Data Cleaning - Handling missing data, outliers, data imputation.",
                "Module 2: Variable Transformations - Log transform, power transform, scaling, standardization.",
                "Module 3: Categorical Encoding - One-hot encoding, label encoding, target encoding.",
                "Module 4: Feature Selection - Filter, wrapper, and embedded methods, correlation analysis.",
                "Module 5: Dimensionality Reduction - Principal Component Analysis (PCA), LDA, t-SNE."
            ]
        }
    ];

    // BBA Subjects (Marketing, OB, Media Literacy)
    window.CLASS_SUBJECTS_BBA = [
        {
            code: "MG2CCRBBA101",
            title: "Marketing Management",
            type: "Core",
            credits: 4,
            teacher: {
                name: "Prof. Rajesh K. Nair",
                designation: "Assistant Professor",
                email: "rajesh.nair@maraugusthinose.edu.in",
                hours: "Mon & Wed, 1:30 PM - 2:30 PM",
                room: "Cabin M-01, Management Block"
            },
            syllabus: [
                "Module 1: Introduction to Marketing - Core concepts, orientation, environment.",
                "Module 2: Market Segmentation - Segmentation, targeting, positioning (STP).",
                "Module 3: Product Strategy - Product mix, life cycle, branding, pricing.",
                "Module 4: Distribution Channels - Retail, wholesale, logistics management.",
                "Module 5: Promotion Mix - Advertising, sales promotion, PR, digital marketing."
            ]
        },
        {
            code: "MG2CCRBBA100",
            title: "Organisation Behaviour",
            type: "Core",
            credits: 4,
            teacher: {
                name: "Dr. Elizabeth Jose",
                designation: "Associate Professor & Dean",
                email: "elizabeth.jose@maraugusthinose.edu.in",
                hours: "Tue & Fri, 10:30 AM - 11:30 AM",
                room: "Dean's Office, Management Block"
            },
            syllabus: [
                "Module 1: OB Foundations - Scope, models, cognitive processes.",
                "Module 2: Individual Behaviour - Personality, perception, learning, attitudes.",
                "Module 3: Motivation and Stress - Theories of motivation, stress management.",
                "Module 4: Group Dynamics - Leadership, power, politics, communication.",
                "Module 5: Organisational Design - Culture, development, change management."
            ]
        },
        {
            code: "MG2MDEBBA100",
            title: "Media Literacy",
            type: "Complementary",
            credits: 3,
            teacher: {
                name: "Prof. Sreejith R.",
                designation: "Assistant Professor",
                email: "sreejith.r@maraugusthinose.edu.in",
                hours: "Wed & Thu, 11:30 AM - 12:30 PM",
                room: "Cabin H-02, Arts wing"
            },
            syllabus: [
                "Module 1: Intro to Media - Evolution of media, mass communication.",
                "Module 2: Media Analysis - Deconstructing news, advertising, visual codes.",
                "Module 3: Digital Literacy - Social media filters, algorithms, echo chambers.",
                "Module 4: Media Ethics - Copyright, privacy, fake news, journalism laws.",
                "Module 5: Audience Engagement - Content creation, community building."
            ]
        }
    ];

    // BSW Subjects (Social Work Profession, Positive Mental Health)
    window.CLASS_SUBJECTS_BSW = [
        {
            code: "MG2DSCSWK100",
            title: "Social Work Profession",
            type: "Core",
            credits: 4,
            teacher: {
                name: "Dr. Joseph Sebastian",
                designation: "Professor & Head BSW",
                email: "joseph.s@maraugusthinose.edu.in",
                hours: "Mon & Thu, 9:30 AM - 10:30 AM",
                room: "BSW Cabin A-1, Social Work Block"
            },
            syllabus: [
                "Module 1: Social Work Intro - Values, principles, historical evolution.",
                "Module 2: Social Reformers - Pioneers in social reform, charity concepts.",
                "Module 3: Methods of Social Work - Casework, group work, community organization.",
                "Module 4: Fields of Practice - Medical, psychiatric, family & child welfare.",
                "Module 5: Code of Ethics - Professional associations, ethical dilemmas."
            ]
        },
        {
            code: "MG2MDCSWK101",
            title: "Positive Mental Health",
            type: "Complementary",
            credits: 4,
            teacher: {
                name: "Prof. Deepa Shaji",
                designation: "Senior Lecturer",
                email: "deepa.shaji@maraugusthinose.edu.in",
                hours: "Tue & Fri, 11:30 AM - 12:30 PM",
                room: "BSW Cabin B-03, Social Work Block"
            },
            syllabus: [
                "Module 1: Mental Health Foundations - Defining wellness, positive psychology.",
                "Module 2: Emotional Intelligence - Self-regulation, empathy, motivation.",
                "Module 3: Stress and Coping - Resilience, mindfulness, stress reduction.",
                "Module 4: Relationships and Health - Active listening, empathy, boundaries.",
                "Module 5: Self-Care Strategies - Goal setting, healthy habits, wellbeing index."
            ]
        }
    ];

    // ==========================================
    // 3. EXAM TIMETABLES & SCHEDULES
    // ==========================================
    
    // Consolidated exam schedules dynamically synced
    window.EXAM_TIMETABLE = [
        // DAY 1
        { day: "Day 1", date: "16-07-2026", dept: "BCA", code: "MG2AECENG100", title: "English" },
        { day: "Day 1", date: "16-07-2026", dept: "BBA", code: "MG2AECENG102", title: "English for Commerce" },
        { day: "Day 1", date: "16-07-2026", dept: "BSW", code: "MG2AECENG101", title: "English for Arts & Humanities" },

        // DAY 2
        { day: "Day 2", date: "17-07-2026", dept: "BCA", code: "MG2AECMAL100 / MG2AECHIN100", title: "Malayalam / Hindi" },
        { day: "Day 2", date: "17-07-2026", dept: "BBA", code: "MG2AECMAL102 / MG2AECHIN102", title: "Malayalam / Hindi" },
        { day: "Day 2", date: "17-07-2026", dept: "BSW", code: "MG2AECMAL101 / MG2AECHIN101", title: "Malayalam / Hindi" },

        // DAY 3
        { day: "Day 3", date: "20-07-2026", dept: "BCA", code: "MG2CCRBCA100", title: "Mathematics II" },
        { day: "Day 3", date: "20-07-2026", dept: "BBA", code: "MG2CCRBBA100", title: "Organisation Behaviour" },

        // DAY 5
        { day: "Day 5", date: "22-07-2026", dept: "BCA", code: "MG2CCRBCA101", title: "Data Structures" },
        { day: "Day 5", date: "22-07-2026", dept: "BBA", code: "MG2CCRBBA101", title: "Marketing Management" },

        // DAY 7
        { day: "Day 7", date: "24-07-2026", dept: "BCA", code: "MG2CCRBCA102", title: "Operating Systems" },
        { day: "Day 7", date: "24-07-2026", dept: "BSW", code: "MG2DSCSWK100", title: "Social Work Profession" },

        // DAY 8
        { day: "Day 8", date: "27-07-2026", dept: "BCA", code: "MG2VACBCA100", title: "Indian Constitution" },

        // DAY 9
        { day: "Day 9", date: "28-07-2026", dept: "BSW", code: "MG2MDCSWK101", title: "Positive Mental Health" },

        // DAY 11
        { day: "Day 11", date: "30-07-2026", dept: "BCA", code: "MG2SECBCA100", title: "Web Technologies" },

        // DAY 12
        { day: "Day 12", date: "05-08-2026", dept: "BBA", code: "MG2MDEBBA100", title: "Media Literacy" }
    ];
})();
