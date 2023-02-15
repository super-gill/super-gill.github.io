var suitClubs = [];
var suitDiamonds = [];
var suitHearts = [];
var suitSpade = [];
var history = [];
var userGuess;


function buildDeck() {
    for (i = 1; i <= 13; i++) {
        suitDiamonds.push(i + " Diamond");
    } console.log(suitDiamonds);
    for (i = 1; i <= 13; i++) {
        suitHearts.push(i + " Heart");
    } console.log(suitHearts);
    for (i = 1; i <= 13; i++) {
        suitClubs.push(i + " Club");
    } console.log(suitClubs);
    for (i = 1; i <= 13; i++) {
        suitSpade.push(i + " Spade");
    } console.log(suitSpade);
    var deck = suitClubs.concat(suitDiamonds, suitHearts, suitSpade);
    console.log(deck);
};


for (i = 0; i < 2; i++) {
    document.getElementsByClassName("game-button")[i].addEventListener("click", function () {

        userGuess = this.value;
        console.log(userGuess);
    })
}

function nextCard() {
    var randomSuit = Mathfoor((Math.random * 4) + 1);
    var randomCard = Mathfloor((Math.random * 13) + 1);

    if ( randomSuit = 1) { }

}



