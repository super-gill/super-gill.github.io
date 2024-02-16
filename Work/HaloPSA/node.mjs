// Hostname: halo.digital-origin.co.uk
// Tenant: digitalorigin
// Client Secret: fecde674-bba1-488a-bc66-bb854bde1ac3-bfe9e3d7-141b-408f-90ad-60d7cc9bf7a6
// ClientID: 3ebb0a12-2492-44c2-8b2f-461b86785089
// let halo = new haloPSA("halo.digital-origin.co.uk", "id", "secret", "digitalorigin");

let halo = new haloPSA("halo.digital-origin.co.uk", "3ebb0a12-2492-44c2-8b2f-461b86785089", "fecde674-bba1-488a-bc66-bb854bde1ac3-bfe9e3d7-141b-408f-90ad-60d7cc9bf7a6", "digitalorigin");

import { haloPSA } from "halopsa";









function dontQuestionMyMethods() {

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
                count: 9999,
                ticket_id: item.id
            });
            let closingActions = TicketActions.actions.filter(v => {return v.outcome == "Close"})
            if (closingActions.length >= 3) {
                AgentsTicketsNotFixedFirstTime.push(item);
            }
        }
        results.push({name: agent.name, tickets: AgentsTicketsNotFixedFirstTime});
    }

    for (let result of results) {
        console.log(`Agent: ${result.name}\nTickets Failed: ${result.tickets ? result.tickets.length : "N/A"}\n`);
    }
    
}

init();

}