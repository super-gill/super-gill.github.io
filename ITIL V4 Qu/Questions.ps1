############################################################
# EXTRA QUESTION BANKS (ASCII CLEAN)
############################################################

# Extra questions built from the ITIL 4 glossary & workbook definitions
$extraQuestions = @(
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 1
        Question       = "Which term refers to the perceived benefits, usefulness and importance of something?"
        Options        = @{
            A = "Outcome"
            B = "Value"
            C = "Utility"
            D = "Warranty"
        }
        Answer    = "B"
        Reference = "Glossary - Value; Workbook Module 2"
        Feedback  = "In ITIL 4, value is the perceived benefits, usefulness and importance of something to stakeholders."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 2
        Question       = "Which term describes a person or group that has its own functions, responsibilities, authorities and relationships to achieve objectives?"
        Options        = @{
            A = "Organization"
            B = "Consumer"
            C = "Supplier"
            D = "Stakeholder"
        }
        Answer    = "A"
        Reference = "Glossary - Organization"
        Feedback  = "An organization is a person or group of people with its own functions, responsibilities, authorities and relationships for achieving objectives."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 3
        Question       = "Why are service relationships established between two or more organizations?"
        Options        = @{
            A = "To co-create value"
            B = "To remove the need for governance"
            C = "To guarantee supplier profitability"
            D = "To reduce staff numbers"
        }
        Answer    = "A"
        Reference = "Workbook Module 2 - Service relationships"
        Feedback  = "Service relationships between provider and consumer organizations are established in order to co-create value."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 4
        Question       = "Which role is a person or organization that uses services?"
        Options        = @{
            A = "Customer"
            B = "Consumer"
            C = "Sponsor"
            D = "Supplier"
        }
        Answer    = "B"
        Reference = "Glossary - Consumer"
        Feedback  = "A consumer is any person or organization that uses services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 5
        Question       = "Which statement BEST describes the roles of customers and sponsors in service consumption?"
        Options        = @{
            A = "Customers define service requirements and take responsibility for outcomes; sponsors authorize budgets for service consumption."
            B = "Customers authorize budgets; sponsors use services in day-to-day work."
            C = "Customers operate services; sponsors design them and define requirements."
            D = "Customers and sponsors have identical responsibilities for all services."
        }
        Answer    = "A"
        Reference = "Glossary - Customer, Sponsor; Workbook Module 2"
        Feedback  = "Customers define requirements and are accountable for outcomes, while sponsors authorize the budgets for service consumption."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 6
        Question       = "Which statement about customers, users and sponsors is CORRECT?"
        Options        = @{
            A = "They can only be individuals, not organizations."
            B = "They can never be the same person or organization."
            C = "They must all have identical expectations of services."
            D = "They can have different and even conflicting expectations of services."
        }
        Answer    = "D"
        Reference = "Workbook Module 2 - Customers, users and sponsors"
        Feedback  = "In ITIL 4, customers, users and sponsors can have different, and sometimes conflicting, expectations of services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 7
        Question       = "Which term is a configuration of an organization’s resources designed to offer value to a consumer?"
        Options        = @{
            A = "Service"
            B = "Product"
            C = "Service offering"
            D = "Outcome"
        }
        Answer    = "B"
        Reference = "Glossary - Product"
        Feedback  = "A product is a configuration of an organization’s resources designed to offer value to a consumer."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 8
        Question       = "Which term is a description of one or more services designed to address the needs of a target consumer group?"
        Options        = @{
            A = "Service offering"
            B = "Service catalogue"
            C = "Service level"
            D = "Outcome"
        }
        Answer    = "A"
        Reference = "Glossary - Service offering"
        Feedback  = "A service offering is a formal description of one or more services for a target consumer group."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 9
        Question       = "Which term is a means of enabling value co-creation by facilitating outcomes that customers want to achieve, without the customer managing specific costs and risks?"
        Options        = @{
            A = "Service"
            B = "Service offering"
            C = "Product"
            D = "Practice"
        }
        Answer    = "A"
        Reference = "Glossary - Service"
        Feedback  = "This is the ITIL 4 definition of a service."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 10
        Question       = "Which term describes activities performed by an organization to provide services, such as managing provider resources and fulfilling agreed actions for users?"
        Options        = @{
            A = "Service provision"
            B = "Service consumption"
            C = "Service relationship management"
            D = "Relationship management"
        }
        Answer    = "A"
        Reference = "Glossary - Service provision"
        Feedback  = "Service provision covers the provider-side activities such as managing resources, granting access and fulfilling agreed actions."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 11
        Question       = "Which term describes activities performed by an organization to use services, such as managing consumer resources and receiving or using service outputs?"
        Options        = @{
            A = "Service provision"
            B = "Service consumption"
            C = "Service value chain"
            D = "Supplier management"
        }
        Answer    = "B"
        Reference = "Glossary - Service consumption"
        Feedback  = "Service consumption covers consumer-side activities, including using services and managing the resources needed to use them."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 12
        Question       = "Which pair is considered the main inputs to the service value system (SVS)?"
        Options        = @{
            A = "Outputs and outcomes"
            B = "Opportunity and demand"
            C = "Value and warranty"
            D = "Utility and warranty"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Service value system"
        Feedback  = "The service value system takes opportunity and demand as its key inputs and produces value as its output."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 13
        Question       = "In ITIL 4, what is a practice?"
        Options        = @{
            A = "A set of interrelated activities that transform inputs into outputs."
            B = "A set of organizational resources designed for performing work or accomplishing an objective."
            C = "A documented step-by-step way to carry out a task."
            D = "A contract between a service provider and a customer."
        }
        Answer    = "B"
        Reference = "Glossary - Practice"
        Feedback  = "A practice is a set of organizational resources designed for performing work or accomplishing an objective."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 14
        Question       = "Which term is defined as a possible event that could cause harm or loss, or make it more difficult to achieve objectives?"
        Options        = @{
            A = "Problem"
            B = "Risk"
            C = "Incident"
            D = "Event"
        }
        Answer    = "B"
        Reference = "Glossary - Risk"
        Feedback  = "Risk is a possible event that could cause harm or loss, or make objectives harder to achieve."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 15
        Question       = "Which term is defined as the amount of money spent on a specific activity or resource?"
        Options        = @{
            A = "Cost"
            B = "Value"
            C = "Budget"
            D = "Expense"
        }
        Answer    = "A"
        Reference = "Glossary - Cost"
        Feedback  = "Cost is the amount of money spent on a specific activity or resource."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 16
        Question       = "Which term is defined as any financially valuable component that can contribute to the delivery of an IT product or service?"
        Options        = @{
            A = "IT asset"
            B = "Configuration item"
            C = "Resource"
            D = "Service component"
        }
        Answer    = "A"
        Reference = "Glossary - IT asset; Workbook Module 5"
        Feedback  = "An IT asset is any financially valuable component that can contribute to delivering an IT product or service."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 17
        Question       = "Which term is defined as any component that needs to be managed in order to deliver an IT service?"
        Options        = @{
            A = "Configuration item"
            B = "IT asset"
            C = "Event"
            D = "Release"
        }
        Answer    = "A"
        Reference = "Glossary - Configuration item"
        Feedback  = "A configuration item is any component that needs to be managed to deliver an IT service."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 18
        Question       = "Which term describes a documented agreement between a service provider and a customer that identifies both services required and the expected level of service?"
        Options        = @{
            A = "Service request"
            B = "Service level agreement"
            C = "Service catalogue"
            D = "Contract"
        }
        Answer    = "B"
        Reference = "Glossary - Service level agreement"
        Feedback  = "A service level agreement identifies the services required and the expected levels of service between provider and customer."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 19
        Question       = "Which term is defined as one or more metrics that define expected or achieved service quality?"
        Options        = @{
            A = "Key performance indicator (KPI)"
            B = "Service level"
            C = "Service level agreement"
            D = "Output"
        }
        Answer    = "B"
        Reference = "Glossary - Service level"
        Feedback  = "A service level is one or more metrics that define expected or achieved service quality."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 20
        Question       = "Which statement about outputs and outcomes is CORRECT?"
        Options        = @{
            A = "Outputs are results for stakeholders; outcomes are the products created by activities."
            B = "Outputs and outcomes are synonyms in ITIL 4."
            C = "Outputs are tangible or intangible deliverables of activities; outcomes are results for stakeholders enabled by those outputs."
            D = "Outcomes are always measurable; outputs are always intangible."
        }
        Answer    = "C"
        Reference = "Workbook Module 2 - Outputs and outcomes"
        Feedback  = "Outputs are the deliverables produced by activities; outcomes are the results for stakeholders that those outputs help to achieve."
    }
)

# Additional custom questions (Paper 3 - Q21 to Q80)
$extraQuestions2 = @(
    ############################
    # KEY CONCEPTS & ROLES
    ############################

    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 21
        Question       = "Which statement BEST describes service management in ITIL 4?"
        Options        = @{
            A = "A set of specialized capabilities that enable an organization to deliver value to customers through services"
            B = "A collection of tools used to monitor servers and networks"
            C = "A process used only for designing new IT applications"
            D = "A way of recording financial transactions for IT projects"
        }
        Answer    = "A"
        Reference = "Glossary - Service management; Workbook Module 2"
        Feedback  = "In ITIL 4, service management is about the specialized organizational capabilities that enable value creation for customers via services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 22
        Question       = "Which service consumer role is PRIMARILY responsible for authorizing the budget for service consumption?"
        Options        = @{
            A = "User"
            B = "Customer"
            C = "Sponsor"
            D = "Supplier"
        }
        Answer    = "C"
        Reference = "Glossary - Sponsor; Workbook Module 2"
        Feedback  = "The sponsor is the person or group that authorizes the budget for service consumption and is accountable for funding."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 23
        Question       = "Which service consumer role is MOST associated with day-to-day use of services?"
        Options        = @{
            A = "User"
            B = "Sponsor"
            C = "Supplier"
            D = "Governing body"
        }
        Answer    = "A"
        Reference = "Glossary - User; Workbook Module 2"
        Feedback  = "A user is the role that actually uses the services on a daily basis."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 24
        Question       = "Which statement BEST describes the customer role?"
        Options        = @{
            A = "The role that uses services in day-to-day work"
            B = "The role that defines requirements and takes responsibility for the outcomes of service consumption"
            C = "The role that supplies physical components to the service provider"
            D = "The role that operates monitoring tools for the service provider"
        }
        Answer    = "B"
        Reference = "Glossary - Customer; Workbook Module 2"
        Feedback  = "The customer defines the requirements for a service and is responsible for the outcomes that result from using the service."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 25
        Question       = "Which statement about value is CORRECT in the context of ITIL 4?"
        Options        = @{
            A = "Value is the total cost of providing a service"
            B = "Value is the functionality provided by a service"
            C = "Value is the perceived benefits, usefulness, and importance of something"
            D = "Value is the number of incidents handled for a customer"
        }
        Answer    = "C"
        Reference = "Glossary - Value; Workbook Module 2"
        Feedback  = "Value is defined in ITIL 4 as the perceived benefits, usefulness, and importance of something."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 26
        Question       = "Which statement about outputs and outcomes is CORRECT?"
        Options        = @{
            A = "Outputs are the results experienced by stakeholders; outcomes are the deliverables from activities"
            B = "Outputs and outcomes mean exactly the same thing in ITIL 4"
            C = "Outputs are tangible or intangible deliverables; outcomes are results for stakeholders enabled by those outputs"
            D = "Outputs refer only to financial results; outcomes refer only to technical results"
        }
        Answer    = "C"
        Reference = "Glossary - Output, Outcome; Workbook Module 2"
        Feedback  = "Outputs are the deliverables produced by activities, while outcomes are the stakeholder results enabled by those outputs."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 27
        Question       = "A law firm moves its email to a cloud service so it no longer needs to run its own mail servers. For the firm, what does the removal of on-premise mail servers represent?"
        Options        = @{
            A = "A cost imposed by the service"
            B = "A cost removed by the service"
            C = "A warranty breach"
            D = "A configuration item"
        }
        Answer    = "B"
        Reference = "Workbook Module 2 - Costs removed and imposed"
        Feedback  = "Using a cloud email service removes the cost of running on-premise mail servers, so this is a cost removed by the service."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 28
        Question       = "How is risk defined in ITIL 4?"
        Options        = @{
            A = "A possible event that could cause harm, loss, or make it harder to achieve objectives"
            B = "Any unplanned interruption to a service or reduction in service quality"
            C = "A tangible or intangible deliverable produced by an activity"
            D = "The money spent on a specific activity or resource"
        }
        Answer    = "A"
        Reference = "Glossary - Risk; Workbook Module 2"
        Feedback  = "Risk is a possible event that could cause harm or loss, or make it more difficult to meet objectives."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 29
        Question       = "Which option correctly describes utility and warranty?"
        Options        = @{
            A = "Utility is the assurance that requirements will be met; warranty is what the service does"
            B = "Utility is the functionality offered by a service; warranty is the assurance that the service will meet agreed requirements"
            C = "Utility is the total cost of a service; warranty is the perceived value of the service"
            D = "Utility is what the customer pays; warranty is what the provider earns"
        }
        Answer    = "B"
        Reference = "Glossary - Utility, Warranty; Workbook Module 2"
        Feedback  = "Utility is about what the service does, while warranty is about how well the service performs against agreed requirements."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 30
        Question       = "Which statement BEST describes a service offering?"
        Options        = @{
            A = "A legal contract that defines the responsibilities of a supplier"
            B = "A description of a single configuration item in the CMDB"
            C = "A formal document that records all costs associated with a service"
            D = "A combination of goods, access to resources, and service actions offered to a specific consumer group"
        }
        Answer    = "D"
        Reference = "Glossary - Service offering; Workbook Module 2"
        Feedback  = "Service offerings are defined combinations of goods, access to resources, and service actions designed for a particular consumer group."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 31
        Question       = "Which statement about service provision and service consumption is CORRECT?"
        Options        = @{
            A = "Service provision is performed only by users; service consumption is performed only by suppliers"
            B = "Service provision includes managing resources and providing access; service consumption includes activities performed by consumers to use services"
            C = "Service provision and service consumption are different names for the same set of activities"
            D = "Service consumption is limited to paying for services and does not include any other activities"
        }
        Answer    = "B"
        Reference = "Workbook Module 2 - Service provision and consumption"
        Feedback  = "Service provision covers activities such as managing resources and providing access to services, while service consumption covers how consumers use and benefit from those services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 32
        Question       = "What is service relationship management concerned with?"
        Options        = @{
            A = "Joint activities between provider and consumer to ensure continual value co-creation"
            B = "The internal budgeting process for new infrastructure"
            C = "The development of hardware components by suppliers"
            D = "The technical design of databases used by services"
        }
        Answer    = "A"
        Reference = "Glossary - Service relationship management; Workbook Module 2"
        Feedback  = "Service relationship management focuses on joint activities performed by the provider and consumer to support continual value co-creation."
    }

    ############################
    # GUIDING PRINCIPLES
    ############################

    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 33
        Question       = "What is a guiding principle in ITIL 4?"
        Options        = @{
            A = "A detailed procedure that must be followed step by step"
            B = "A recommendation that guides an organization in all circumstances"
            C = "A document that describes the architecture of IT systems"
            D = "A role responsible for authorizing changes"
        }
        Answer    = "B"
        Reference = "Workbook Module 4 - Definition of guiding principle"
        Feedback  = "A guiding principle is a recommendation that can guide an organization in all circumstances, regardless of changes in goals or management."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 34
        Question       = "Which guiding principle focuses on understanding what creates value from the service consumer's perspective?"
        Options        = @{
            A = "Start where you are"
            B = "Focus on value"
            C = "Keep it simple and practical"
            D = "Optimize and automate"
        }
        Answer    = "B"
        Reference = "Workbook Module 4 - Focus on value"
        Feedback  = "Focus on value means that everything the organization does should link back to what delivers value for the service consumer."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 35
        Question       = "Which guiding principle recommends that work should be broken into smaller, manageable sections that can be completed and reviewed frequently?"
        Options        = @{
            A = "Progress iteratively with feedback"
            B = "Collaborate and promote visibility"
            C = "Think and work holistically"
            D = "Start where you are"
        }
        Answer    = "A"
        Reference = "Workbook Module 4 - Progress iteratively with feedback"
        Feedback  = "Progress iteratively with feedback advises breaking work into small pieces that can be delivered, evaluated, and adjusted quickly."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 36
        Question       = "Which guiding principle emphasizes working together across boundaries and making work and outcomes visible?"
        Options        = @{
            A = "Keep it simple and practical"
            B = "Collaborate and promote visibility"
            C = "Think and work holistically"
            D = "Optimize and automate"
        }
        Answer    = "B"
        Reference = "Workbook Module 4 - Collaborate and promote visibility"
        Feedback  = "Collaborate and promote visibility highlights the value of working together and ensuring that plans, progress, and results are transparent."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 37
        Question       = "Which guiding principle warns against doing extensive analysis without actually delivering improvements, sometimes known as 'analysis paralysis'?"
        Options        = @{
            A = "Start where you are"
            B = "Progress iteratively with feedback"
            C = "Optimize and automate"
            D = "Think and work holistically"
        }
        Answer    = "B"
        Reference = "Workbook Module 4 - Progress iteratively with feedback"
        Feedback  = "Progress iteratively with feedback encourages taking action in small steps, rather than delaying improvements due to excessive analysis."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 38
        Question       = "Which guiding principle encourages you to review the current situation using available information before building something new?"
        Options        = @{
            A = "Start where you are"
            B = "Keep it simple and practical"
            C = "Collaborate and promote visibility"
            D = "Optimize and automate"
        }
        Answer    = "A"
        Reference = "Workbook Module 4 - Start where you are"
        Feedback  = "Start where you are advises organizations to assess the current state using data and direct observation, and to reuse existing resources where sensible."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 39
        Question       = "Which guiding principle focuses on removing unnecessary activities and making sure each step adds value?"
        Options        = @{
            A = "Keep it simple and practical"
            B = "Think and work holistically"
            C = "Collaborate and promote visibility"
            D = "Start where you are"
        }
        Answer    = "A"
        Reference = "Workbook Module 4 - Keep it simple and practical"
        Feedback  = "Keep it simple and practical emphasizes eliminating anything that does not directly contribute to value, to avoid over-complication."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 40
        Question       = "Which guiding principle highlights the need to consider all aspects of the organization, including the four dimensions of service management?"
        Options        = @{
            A = "Think and work holistically"
            B = "Optimize and automate"
            C = "Focus on value"
            D = "Start where you are"
        }
        Answer    = "A"
        Reference = "Workbook Module 4 - Think and work holistically"
        Feedback  = "Think and work holistically reminds you that services are delivered through many interconnected components and perspectives, including all four dimensions."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 41
        Question       = "According to the 'optimize and automate' guiding principle, what should you do BEFORE introducing automation?"
        Options        = @{
            A = "Automate first and then identify improvements"
            B = "Ensure the process is optimized and as effective as possible"
            C = "Remove all human involvement from the process"
            D = "Outsource the process to a third-party supplier"
        }
        Answer    = "B"
        Reference = "Workbook Module 4 - Optimize and automate"
        Feedback  = "Optimize and automate advises improving and simplifying processes before automating them, otherwise automation can amplify existing problems."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 42
        Question       = "How should the seven guiding principles be used in practice?"
        Options        = @{
            A = "Select a single principle and apply only that one"
            B = "Use them in isolation from one another"
            C = "Consider all of them and apply those that are relevant to the situation"
            D = "Use only the principles that directly mention technology"
        }
        Answer    = "C"
        Reference = "Workbook Module 4 - Using the guiding principles"
        Feedback  = "ITIL 4 recommends that all guiding principles are considered, and the relevant ones applied together in each situation."
    }

    ############################
    # FOUR DIMENSIONS
    ############################

    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 43
        Question       = "Which service management dimension focuses on roles, responsibilities, organizational structure, and culture?"
        Options        = @{
            A = "Organizations and people"
            B = "Information and technology"
            C = "Partners and suppliers"
            D = "Value streams and processes"
        }
        Answer    = "A"
        Reference = "Workbook Module 3 - Organizations and people"
        Feedback  = "The organizations and people dimension considers structure, roles, culture, competencies, and communication."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 44
        Question       = "Which service management dimension focuses on the information needed to deliver services and the technologies that support them?"
        Options        = @{
            A = "Organizations and people"
            B = "Information and technology"
            C = "Partners and suppliers"
            D = "Value streams and processes"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Information and technology"
        Feedback  = "The information and technology dimension covers both the information and knowledge needed, and the technologies that support service delivery and consumption."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 45
        Question       = "Which service management dimension focuses on the organization's relationships with other organizations that help design, deliver, and improve services?"
        Options        = @{
            A = "Organizations and people"
            B = "Information and technology"
            C = "Partners and suppliers"
            D = "Value streams and processes"
        }
        Answer    = "C"
        Reference = "Workbook Module 3 - Partners and suppliers"
        Feedback  = "The partners and suppliers dimension covers relationships with other organizations and the contracts and agreements that support services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 46
        Question       = "Which service management dimension focuses on how activities are organized and how the organization ensures efficient value creation?"
        Options        = @{
            A = "Organizations and people"
            B = "Information and technology"
            C = "Partners and suppliers"
            D = "Value streams and processes"
        }
        Answer    = "D"
        Reference = "Workbook Module 3 - Value streams and processes"
        Feedback  = "The value streams and processes dimension looks at the activities the organization performs, how they are arranged, and how they contribute to value creation."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 47
        Question       = "What is a possible consequence of failing to consider all four dimensions of service management?"
        Options        = @{
            A = "Services will automatically become cheaper"
            B = "Services may become undeliverable or fail to meet expectations"
            C = "Only technical performance will improve"
            D = "Guiding principles will no longer be relevant"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Importance of four dimensions"
        Feedback  = "ITIL 4 warns that ignoring one or more dimensions can make services undeliverable or cause them to miss quality and efficiency expectations."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 48
        Question       = "Which statement about external factors such as PESTLE (political, economic, social, technological, legal, environmental) is CORRECT?"
        Options        = @{
            A = "They only affect the information and technology dimension"
            B = "They can influence any of the four dimensions of service management"
            C = "They are not considered within the ITIL 4 framework"
            D = "They apply only to suppliers and not to internal services"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - External factors"
        Feedback  = "External factors such as PESTLE can affect any of the four dimensions and must be considered when designing and improving services."
    }

    ############################
    # SVS & SERVICE VALUE CHAIN
    ############################

    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 49
        Question       = "What is the purpose of the ITIL service value system (SVS)?"
        Options        = @{
            A = "To document all incidents and problems in a single database"
            B = "To ensure the organization continually co-creates value with all stakeholders"
            C = "To describe only the technical architecture of IT services"
            D = "To replace all existing management practices with new ones"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Service value system"
        Feedback  = "The SVS is designed to ensure that the organization continually co-creates value with all stakeholders through the use and management of services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 50
        Question       = "Which is a component of the ITIL service value system (SVS)?"
        Options        = @{
            A = "The seven guiding principles"
            B = "The PESTLE model"
            C = "The project management office"
            D = "The incident priority matrix"
        }
        Answer    = "A"
        Reference = "Workbook Module 3 - SVS components"
        Feedback  = "The components of the SVS include the guiding principles, governance, service value chain, practices, and continual improvement."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 51
        Question       = "Which statement about the service value chain is CORRECT?"
        Options        = @{
            A = "It is a linear process that must always be followed in the same order"
            B = "Each value chain activity transforms inputs into outputs using a combination of practices"
            C = "It applies only to external customers and not internal ones"
            D = "It replaces all management practices in ITIL 4"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Service value chain"
        Feedback  = "Each service value chain activity uses a combination of practices to convert inputs into outputs that contribute to value creation."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 52
        Question       = "What is the purpose of the 'plan' value chain activity?"
        Options        = @{
            A = "To obtain or create service components"
            B = "To provide a shared understanding of the vision, current status, and improvement direction"
            C = "To ensure continual engagement and good relationships with stakeholders"
            D = "To restore normal service operation as quickly as possible"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Plan activity"
        Feedback  = "The plan activity ensures there is a shared understanding of the organization's vision, status, and direction for improvement across all products and services."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 53
        Question       = "What is the purpose of the 'improve' value chain activity?"
        Options        = @{
            A = "To provide new and changed services to customers"
            B = "To ensure continual improvement of products, services, and practices"
            C = "To create and manage service level agreements"
            D = "To authorize normal and emergency changes"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Improve activity"
        Feedback  = "The improve activity ensures continual improvement of products, services, and practices across all value chain activities and all four dimensions."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 54
        Question       = "What is the purpose of the 'engage' value chain activity?"
        Options        = @{
            A = "To build and test service components"
            B = "To provide a good understanding of stakeholder needs and maintain good relationships"
            C = "To create high-level strategic plans"
            D = "To manage configuration records for all services"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Engage activity"
        Feedback  = "Engage ensures that stakeholder needs are understood, and that transparency, engagement, and good relationships are maintained."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 55
        Question       = "What is the purpose of the 'design and transition' value chain activity?"
        Options        = @{
            A = "To ensure that products and services continually meet stakeholder expectations for quality, costs, and time to market"
            B = "To ensure that the organization's suppliers are managed appropriately"
            C = "To restore normal service operation as quickly as possible"
            D = "To approve and schedule standard changes"
        }
        Answer    = "A"
        Reference = "Workbook Module 3 - Design and transition activity"
        Feedback  = "Design and transition ensures that products and services continue to meet stakeholder expectations for quality, costs, and time to market."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 56
        Question       = "What is the purpose of the 'obtain/build' value chain activity?"
        Options        = @{
            A = "To ensure that service components are available when needed and meet agreed specifications"
            B = "To manage the relationship between the provider and external regulators"
            C = "To develop financial policies for all IT services"
            D = "To capture demand for incident resolution and service requests"
        }
        Answer    = "A"
        Reference = "Workbook Module 3 - Obtain/build activity"
        Feedback  = "Obtain/build ensures that service components are acquired or created so that they are available where and when they are needed and meet agreed requirements."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 57
        Question       = "What is the purpose of the 'deliver and support' value chain activity?"
        Options        = @{
            A = "To coordinate all improvement initiatives"
            B = "To ensure services are delivered and supported according to agreed specifications and expectations"
            C = "To create the enterprise architecture of the organization"
            D = "To design new operating models for suppliers"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Deliver and support activity"
        Feedback  = "Deliver and support is focused on delivering services and supporting them in line with agreed specifications and expectations."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 58
        Question       = "How do the service value chain activities collectively support value creation?"
        Options        = @{
            A = "By operating completely independently of one another"
            B = "By using combinations of practices to convert opportunities and demand into value"
            C = "By eliminating the need for management practices"
            D = "By focusing only on the deployment of new technology"
        }
        Answer    = "B"
        Reference = "Workbook Module 3 - Service value chain overview"
        Feedback  = "All value chain activities use suitable combinations of practices to convert opportunities and demand into value for stakeholders."
    }

    ############################
    # PRACTICES & DEFINITIONS
    ############################

    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 59
        Question       = "What is the purpose of the information security management practice?"
        Options        = @{
            A = "To ensure that accurate information about configuration items is available"
            B = "To protect the information needed by the organization to conduct its business"
            C = "To record and manage all incidents to restore service quickly"
            D = "To plan and manage the full life cycle of IT assets"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Information security management"
        Feedback  = "Information security management protects information by managing risks to confidentiality, integrity, and availability."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 60
        Question       = "What is the purpose of the relationship management practice?"
        Options        = @{
            A = "To restore normal service operation as quickly as possible"
            B = "To establish and nurture links between the organization and its stakeholders at strategic and tactical levels"
            C = "To plan and manage the life cycle of IT assets"
            D = "To authorize changes and maintain a change schedule"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Relationship management"
        Feedback  = "Relationship management focuses on establishing, analyzing, monitoring, and improving relationships with stakeholders at strategic and tactical levels."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 61
        Question       = "What is the purpose of the supplier management practice?"
        Options        = @{
            A = "To ensure that the organization's suppliers and their performance are managed appropriately to support quality products and services"
            B = "To negotiate staff contracts and benefits with employees"
            C = "To resolve incidents caused by third-party applications"
            D = "To configure monitoring tools for supplier systems"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Supplier management"
        Feedback  = "Supplier management ensures suppliers and their performance are managed so that products and services are delivered seamlessly and reliably."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 62
        Question       = "What is the purpose of the IT asset management practice?"
        Options        = @{
            A = "To ensure that service components are monitored and events are recorded"
            B = "To plan and manage the full life cycle of IT assets"
            C = "To authorize changes and manage a change schedule"
            D = "To record and resolve incidents and service requests"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - IT asset management"
        Feedback  = "IT asset management plans and manages the life cycle of IT assets to maximize value, control costs, manage risks, and support decisions."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 63
        Question       = "What is the purpose of the monitoring and event management practice?"
        Options        = @{
            A = "To systematically observe services and service components and record and report selected changes of state"
            B = "To create detailed service level agreements with customers"
            C = "To restore normal service operation as quickly as possible"
            D = "To provide a single point of contact for users"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Monitoring and event management"
        Feedback  = "Monitoring and event management observes services and components and records and reports selected changes of state as events."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 64
        Question       = "Which practice provides the main point of contact between the service provider and its users?"
        Options        = @{
            A = "Service level management"
            B = "Service desk"
            C = "Change enablement"
            D = "Deployment management"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Service desk"
        Feedback  = "The service desk is the entry point and primary point of contact for users, handling incidents, service requests, and communication."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 65
        Question       = "What is the purpose of the incident management practice?"
        Options        = @{
            A = "To minimize the negative impact of incidents by restoring normal service operation as quickly as possible"
            B = "To identify actual and potential causes of incidents and manage workarounds"
            C = "To ensure that the organization's suppliers are managed appropriately"
            D = "To plan and manage the life cycle of IT assets"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Incident management"
        Feedback  = "Incident management focuses on restoring normal service operation as quickly as possible to minimize the impact on users and business."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 66
        Question       = "What is the purpose of the problem management practice?"
        Options        = @{
            A = "To handle all service requests from users"
            B = "To reduce the likelihood and impact of incidents by managing their causes"
            C = "To ensure all changes are authorized and scheduled"
            D = "To provide financial forecasts for IT projects"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Problem management"
        Feedback  = "Problem management aims to reduce the number and impact of incidents by identifying and controlling their underlying causes."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 67
        Question       = "What is the purpose of the service request management practice?"
        Options        = @{
            A = "To provide users with a channel to obtain pre-defined services or information"
            B = "To identify and manage the underlying causes of incidents"
            C = "To plan and manage the life cycle of infrastructure"
            D = "To enforce security policies and prevent unauthorized access"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Service request management"
        Feedback  = "Service request management handles requests from users for pre-defined services or information that are part of normal service delivery."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 68
        Question       = "What is the purpose of the service level management practice?"
        Options        = @{
            A = "To restore normal service operation as fast as possible"
            B = "To establish clear business-based targets for service performance and ensure delivery against these targets"
            C = "To manage the technical configuration of infrastructure components"
            D = "To authorize and schedule changes to services"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Service level management"
        Feedback  = "Service level management sets clear, business-based service targets and ensures that service performance is monitored and managed against them."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 69
        Question       = "What is the purpose of the service configuration management practice?"
        Options        = @{
            A = "To ensure that accurate and reliable information about configuration items and their relationships is available"
            B = "To manage all financial aspects of service provision"
            C = "To provide a channel for users to log incidents"
            D = "To ensure all changes are properly assessed and authorized"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Service configuration management"
        Feedback  = "Service configuration management ensures that information about configuration items (CIs) and their relationships is accurate, complete, and available when needed."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 70
        Question       = "What is the purpose of the change enablement practice?"
        Options        = @{
            A = "To ensure that risks of changes are properly assessed, and changes are authorized and scheduled"
            B = "To provide and manage self-service portals for users"
            C = "To record and classify all configuration items"
            D = "To create detailed technical designs for new software"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Change enablement"
        Feedback  = "Change enablement ensures changes are assessed for risk, properly authorized, and scheduled to maximize success and minimize disruption."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 71
        Question       = "What is the purpose of the release management practice?"
        Options        = @{
            A = "To move new or changed components into live environments"
            B = "To make new and changed services and features available for use"
            C = "To capture and process incidents and service requests"
            D = "To ensure that suppliers meet their contractual targets"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Release management"
        Feedback  = "Release management coordinates and makes new and changed services and features available for use by customers and users."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 72
        Question       = "What is the purpose of the deployment management practice?"
        Options        = @{
            A = "To move new or changed hardware, software, or other components to live or other environments"
            B = "To approve and schedule changes to services"
            C = "To monitor service components and record events"
            D = "To establish and maintain relationships with stakeholders"
        }
        Answer    = "A"
        Reference = "Quick Reference Guide - Deployment management"
        Feedback  = "Deployment management moves new or changed components into live or other environments such as test or staging."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 73
        Question       = "What is the purpose of the continual improvement practice?"
        Options        = @{
            A = "To ensure that services are delivered and supported according to agreed specifications"
            B = "To align the organization's practices and services with changing business needs by identifying and improving opportunities on an ongoing basis"
            C = "To authorize all changes and maintain a change schedule"
            D = "To provide a single point of contact for users"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - Continual improvement"
        Feedback  = "Continual improvement identifies and acts on improvement opportunities to keep practices, services, and all elements of the SVS aligned with business needs."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 74
        Question       = "Which statement about incidents and problems is CORRECT?"
        Options        = @{
            A = "An incident is the cause of one or more problems"
            B = "A problem is the cause, or potential cause, of one or more incidents"
            C = "Incidents and problems are the same and use the same records"
            D = "Problems are always resolved before incidents are recorded"
        }
        Answer    = "B"
        Reference = "Glossary - Incident, Problem; Workbook Module 5"
        Feedback  = "A problem is the cause, or potential cause, of one or more incidents. Incidents are the actual interruptions or reductions in quality."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 75
        Question       = "Which statement about known errors is CORRECT?"
        Options        = @{
            A = "A known error is a problem that has been analyzed but not resolved"
            B = "A known error is any incident that has been fixed"
            C = "A known error is a problem that has been permanently resolved"
            D = "A known error is the same as a configuration item"
        }
        Answer    = "A"
        Reference = "Glossary - Known error; Workbook Module 5"
        Feedback  = "A known error is a problem for which the cause has been analyzed and is understood, but which has not yet been permanently resolved."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 76
        Question       = "Which statement correctly describes a service request?"
        Options        = @{
            A = "A request from a user for something that is part of the normal delivery of a service"
            B = "An unplanned interruption to a service or reduction in service quality"
            C = "A known error that has not yet been resolved"
            D = "A request to analyze the underlying causes of several related incidents"
        }
        Answer    = "A"
        Reference = "Glossary - Service request; Workbook Module 5"
        Feedback  = "A service request is a request from a user or their representative for something that is part of the normal service delivery, such as information or access."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 77
        Question       = "Which statement about configuration items (CIs) and IT assets is CORRECT?"
        Options        = @{
            A = "All IT assets are CIs, and all CIs are IT assets"
            B = "Some IT assets may not be CIs, and some CIs may not be IT assets"
            C = "CIs only include physical hardware, not software"
            D = "IT assets only include software licenses"
        }
        Answer    = "B"
        Reference = "Quick Reference Guide - IT asset management and service configuration management"
        Feedback  = "The sets of IT assets and configuration items overlap but are not identical; some IT assets are not managed as CIs and vice versa."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 78
        Question       = "Which of the following is the BEST example of a configuration item (CI)?"
        Options        = @{
            A = "A server recorded in the configuration management system with its relationships"
            B = "A complaint from a user about system slowness"
            C = "A financial forecast for IT spending"
            D = "A marketing brochure describing a service"
        }
        Answer    = "A"
        Reference = "Glossary - Configuration item; Workbook Module 5"
        Feedback  = "A configuration item is any component that needs to be managed to deliver services, such as a server stored in a configuration management system."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 79
        Question       = "Which statement about events is CORRECT?"
        Options        = @{
            A = "An event is any unplanned reduction in the quality of a service"
            B = "An event is a change of state that has significance for the management of a service or other configuration item"
            C = "An event is a request from a user for information or advice"
            D = "An event is the permanent resolution of a problem"
        }
        Answer    = "B"
        Reference = "Glossary - Event; Workbook Module 5"
        Feedback  = "An event is a change of state that has significance for the management of a service or other configuration item, often detected by monitoring."
    }
    [pscustomobject]@{
        Paper          = 3
        OriginalNumber = 80
        Question       = "Which type of change is usually pre-authorized and follows a documented procedure because it is low risk and well understood?"
        Options        = @{
            A = "Normal change"
            B = "Emergency change"
            C = "Standard change"
            D = "Major change"
        }
        Answer    = "C"
        Reference = "Workbook Module 5 - Change types"
        Feedback  = "Standard changes are low-risk, well understood, fully documented, and pre-authorized, often initiated as service requests."
    }
)

############################################################
# COMBINE BANKS, RANDOMIZE AND RUN TESTS
############################################################

# Combine into a single bank
# (Assumes you already have $paper1 and $paper2 defined above)
$allQuestions = $paper1 + $paper2 + $extraQuestions + $extraQuestions2

# Shuffle the full bank
$shuffled = $allQuestions | Get-Random -Count $allQuestions.Count

# First 40 -> Test 1, next 40 -> Test 2
$test1Questions = $shuffled[0..39]
$test2Questions = $shuffled[40..79]

############################################################
# FUNCTION TO RUN A TEST
############################################################

function Run-Test {
    param(
        [Parameter(Mandatory)]
        [array]$Questions,

        [Parameter(Mandatory)]
        [string]$TestName
    )

    $score = 0

    Write-Host "`n$TestName" -ForegroundColor Cyan
    Write-Host "You will be asked $($Questions.Count) questions. Enter A, B, C, or D for each.`n"

    $qIndex = 1
    foreach ($q in $Questions) {
	Clear-Host
        Write-Host ""
        Write-Host "Question $qIndex (Source: Sample Paper $($q.Paper), Q$($q.OriginalNumber))`n"
        Write-Host $q.Question -foregroundcolor yellow
	Write-Host "`n"

        foreach ($key in "A","B","C","D") {
            Write-Host ("{0}. {1}" -f $key, $q.Options[$key])
        }

        do {
	    Write-Host "`n"
            $answer = Read-Host "Your answer (A, B, C or D)"
        } while ($answer -notmatch '^[ABCDabcd]$')

        $answer = $answer.ToUpper()

        if ($answer -eq $q.Answer) {
            Write-Host "Correct!" -ForegroundColor Green
            Write-Host ("Explanation: {0}" -f $q.Feedback)
            $score++
        } else {
            Write-Host ("Incorrect. The correct answer is {0}. Reference: {1}" -f $q.Answer, $q.Reference) -ForegroundColor Red
            Write-Host ("Explanation: {0}" -f $q.Feedback)
        }

        $qIndex++
    }

    Write-Host ""
    Write-Host ("{0} complete. You scored {1} out of {2}." -f $TestName, $score, $Questions.Count) -ForegroundColor Cyan
}

############################################################
# RUN TEST 1 AND TEST 2
############################################################

Write-Host "ITIL 4 Foundation - Randomized Two-Test Practice" -ForegroundColor Cyan
Write-Host "Questions are drawn at random from a single bank of 160 (Sample Paper 1 + 2 + extras)."

Run-Test -Questions $test1Questions -TestName "Test 1"

Write-Host ""
Read-Host "Press Enter to start Test 2..."
Run-Test -Questions $test2Questions -TestName "Test 2"
