// Hostname: halo.digital-origin.co.uk
// Tenant: digitalorigin
// Client Secret: fecde674-bba1-488a-bc66-bb854bde1ac3-bfe9e3d7-141b-408f-90ad-60d7cc9bf7a6
// ClientID: 3ebb0a12-2492-44c2-8b2f-461b86785089
// let halo = new haloPSA("halo.digital-origin.co.uk", "id", "secret", "digitalorigin");

// requesttype_id

// ticket type:
// 3 - service request
// 1 - incident

// ------------------------------------------------------

// id: 126943,
// dateoccurred: '2024-02-19T14:12:32.817',
// summary: "can't log in ",
// details: '*What issue are you experiencing?\r\n' +
// status_id: 9,
// tickettype_id: 1,
// sla_id: 1,
// priority_id: 4,
// client_id: 108,
// client_name: 'Thomas Connolly ',
// site_id: 116,
// site_name: 'Main',
// user_id: 14624,
// user_name: 'Carla Levitt',
// team: 'Helpdesk',
// agent_id: 65,
// category_1: 'IT Software>Account Administration>Password Reset',
// category_2: 'Account Administration',
// category_3: '',
// category_4: '',
// estimate: -0,
// estimatedays: 0,
// child_count: 0,
// attachment_count: 0,
// flagged: false,
// read: true,
// enduserstatus: 0,
// onhold: false,
// respondbydate: '2024-02-20T08:12:32.817',
// responsedate: '2024-02-19T14:16:41.077',
// slaresponsestate: 'I',
// fixbydate: '2024-02-21T14:12:32.817',
// dateclosed: '2024-02-19T14:16:41.077',
// dateassigned: '2024-02-19T14:12:33.753',
// excludefromsla: false,
// slaholdtime: 0,
// site_timezone: '',
// lastactiondate: '2024-02-19T14:16:48.577',
// organisation_id: 1,
// department_id: 3,
// reportedby: 'Carla.l@tcmk.co.uk',
// user_email: 'Carla.l@tcmk.co.uk',
// emailtolist: 'carla.l@tcmk.co.uk',
// matched_kb_id: 0,
// product_id: 0,
// release_id: 0,
// release2_id: 0,
// release3_id: 0,
// lastincomingemail: '0001-01-01T00:00:00',
// inventory_number: '1641',
// workflow_id: 1,
// workflow_step: 3,
// workflow_seq: 3,
// pipeline_stage_id: 1,
// hasbeenclosed: true,
// is_vip: false,
// isimportantcontact: false,
// inactive: false,
// impact: 3,
// urgency: 3,
// starttime: '00:00:00',
// starttimeslot: 0,
// targetdate: '1900-01-01T00:00:00',
// targettime: '00:00:00',
// targettimeslot: 0,
// deadlinedate: '1900-01-01T00:00:00',
// oppcompanyname: 'Thomas Connolly ',
// oppvalueadjusted: 0,
// cost: 0,
// quantity: 1,
// userdef1: '',
// userdef2: '',
// userdef3: '',
// userdef4: '',
// userdef5: '',
// source: 3,
// release_important: false,
// releasenotegroup_id: 0,
// supplier_status: 0,
// appointment_type: 0,
// section_timezone: '',
// projectinternaltask: false,
// impactlevel: 0,
// guid: 'e241f9eb-30cf-ee11-8205-c8cf016a67a6',
// use: 'ticket',
// maximumRestrictedPriority: 0,
// idsummary: "126943 - can't log in ",
// ticketage: 0.19119589853819444,
// useful_count: 0,
// notuseful_count: 0,
// updateservicestatus: false,
// servicestatusnote: '',
// itil_requesttype_id: 1,
// closure_agent_id: 65,
// ticket_tags: '',
// invoiceseperatelyoverride: false,
// purchaseordernumber: ''
// },


//incident service request 


// Priority:
// Low: 4
// Med: 3
// high: 2
// crit: 1

//import { haloPSA } from "./node_modules/halopsa/lib/halopsa";
import { haloPSA } from "halopsa";

// let halo = new haloPSA("halo.digital-origin.co.uk", "id", "secret", "digitalorigin");
let halo = new haloPSA("halo.digital-origin.co.uk", "3ebb0a12-2492-44c2-8b2f-461b86785089", "c6ed54bc-3873-4792-990b-a37c064037cd-8657115c-7b07-4600-ba18-a7664d2df58a", "digitalorigin");

//getStats([month 0 - 11], [day 1 - 31])
getStats(1, 19);

//totalPerType()
//totalsPerPriority();

function getStats(passMonth, passDay) {

    let startDate = new Date();
    startDate.setMonth(passMonth);
    startDate.setDate(passDay);
    startDate.setHours(0);

    let endDate = new Date();
    endDate.setMonth(passMonth);
    endDate.setDate(passDay);
    endDate.setHours(23);

    console.log("\n***\n" + "Start: " + startDate + "\n" + "End: " + endDate + "\n***\n")

    halo.getTickets({
        startdate: startDate.toISOString(),
        enddate: endDate.toISOString(),
        datesearch: 'dateoccurred',
        count: 999999,
        team: [1]
    }).then((totalTickets) => {
        console.log("Total tickets: " + totalTickets.tickets.length)
    })

    // let priorities = [1, 2, 3, 4];
    // for (let i of priorities) {
    //     halo.getTickets({
    //         startdate: startDate.toISOString(),
    //         enddate: endDate.toISOString(),
    //         datesearch: 'dateoccurred',
    //         count: 999999,
    //         team: [1],
    //         priority: i
    //     }).then((ticketsResponse) => {
    //         console.log("P" + (i) + " tickets: " + ticketsResponse.tickets.length);
    //     });
    // }

    // let types = [1, 3]

    // for (let i of types) {
    //     halo.getTickets({
    //         startdate: startDate.toISOString(),
    //         enddate: endDate.toISOString(),
    //         count: 999999,
    //         datesearch: 'dateoccurred',
    //         team: [i],
    //         requesttype_id: 1
    //     }).then((ticketsResponse) => {
    //         console.log("Number of " + (i === 1 ? "Incident: " : "Service Request: ") + ticketsResponse.tickets.length);
    //     });

    // }

}





function totalsPerPriority() {
    //Ticket splits based on our SLA response for Priority 1,2 and 3

    let date = new Date();
    date.setMonth(1);
    date.setDate(19);
    date.setHours(0);

    let dateTwo = new Date();
    dateTwo.setMonth(1);
    dateTwo.setDate(19);
    dateTwo.setHours(23);

    let priorities = [1, 2, 3, 4];
    for (let i of priorities) {
        halo.getTickets({
            startdate: date.toISOString(),
            enddate: dateTwo.toISOString(),
            datesearch: 'dateoccurred',
            count: 999999,
            team: [1],
            priority: i
        }).then((ticketsResponse) => {
            console.log("P" + (i) + " tickets: " + ticketsResponse.tickets.length);
        });
    }
}

function totalPerType() {
    //Quantity of ticket types i.e. incidents, service requests

    let date = new Date();
    date.setMonth(1);
    date.setDate(19);
    date.setHours(0);

    let dateTwo = new Date();
    dateTwo.setMonth(1);
    dateTwo.setDate(19);
    dateTwo.setHours(23);

    let types = [1, 3]

    for (let i of types) {

        halo.getTickets({
            startdate: date.toISOString(),
            enddate: dateTwo.toISOString(),
            count: 999999,
            datesearch: 'dateoccurred',
            team: [i],
            requesttype_id: 1
        }).then((ticketsResponse) => {
            console.log("Number of " + (i === 1 ? "Incident: " : "Service Request: ") + ticketsResponse.tickets.length);
        });

    }

}

function ftfPerAgent() {

    async function init() {
        let agents = [
            {
                name: "Luke Wright",
                id: 43
            },
            {
                name: "Jason McDill",
                id: 56
            },
            {
                name: "Jason Deller",
                id: 20
            }
        ]
        let results = [];
        for (let agent of agents) {
            console.log(agent)
            let AgentsTicketsNotFixedFirstTime = [];
            let tickets = (await halo.getTickets({
                agent: [agent.id],
                closed_only: true
            })).tickets;

            for (let item of tickets) {
                let TicketActions = await halo.getActions({
                    count: 999999,
                    ticket_id: item.id
                });
                let closingActions = TicketActions.actions.filter(v => { return v.outcome == "Close" })
                if (closingActions.length >= 3) {
                    AgentsTicketsNotFixedFirstTime.push(item);
                }
            }
            results.push({ name: agent.name, tickets: AgentsTicketsNotFixedFirstTime });
        }

        for (let result of results) {
            console.log(`Agent: ${result.name}\nTickets Failed: ${result.tickets ? result.tickets.length : "N/A"}\n`);
        }

    }

    init();

}