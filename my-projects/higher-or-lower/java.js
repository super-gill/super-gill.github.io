console.log(">>>>>>>>>>>>>>>>>>>>>>> SCRIPT START");

console.log("variables are defined");
var suitClubs = [];
var suitDiamonds = [];
var suitHearts = [];
var suitSpade = [];
var history = [];
var userGuess = undefined;
var activeCard;
var nextCard;
var previousCard;


var randomSuitOne;
var randomCardOne;
var randomSuitTwo;
var randomCardTwo;

var activeCardValue;
var nextCardValue;

var gameCycle = 0;

const card = document.querySelector(".card");
const title = document.querySelector(".title");
const historyP = document.querySelector(".history-p");

console.log("buildDeck() is called")
buildDeck();


function buildDeck() {
    console.log("Deck is built");
    for (i = 1; i <= 13; i++) {
        suitDiamonds.push(i + " Diamond");
    }
    for (i = 1; i <= 13; i++) {
        suitHearts.push(i + " Heart");
    }
    for (i = 1; i <= 13; i++) {
        suitClubs.push(i + " Club");
    }
    for (i = 1; i <= 13; i++) {
        suitSpade.push(i + " Spade");
    }
    var deck = suitClubs.concat(suitDiamonds, suitHearts, suitSpade);
    console.log("cardChoice is called");
    cardChoice();
};

function cardChoice() {
    gameCycle = gameCycle + 1;
    console.log(">>>>>>>>>>>>>>>>>>>>>>> GAME CYCLE START");
    title.innerHTML = "Higher or Lower!"

    activeSequenceCard();
    // console.log("activeSequenceCard is called to randomize the active card");

    function activeSequenceCard() {
        randomSuitOne = Math.floor((Math.random() * 4) + 1);
        randomCardOne = Math.floor((Math.random() * 13));

        switch (randomSuitOne) {
            case 1:
                activeCard = suitClubs[randomCardOne];
                break;

            case 2:
                activeCard = suitDiamonds[randomCardOne];
                break;

            case 3:
                activeCard = suitSpade[randomCardOne];
                break;

            case 4:
                activeCard = suitHearts[randomCardOne];
                break;
        }
        card.innerHTML = activeCard;
        nextSequenceCard();
    }

    function nextSequenceCard() {
        randomSuitTwo = Math.floor((Math.random() * 4) + 1);
        randomCardTwo = Math.floor((Math.random() * 13));
        switch (randomSuitTwo) {
            case 1:
                nextCard = suitClubs[randomCardTwo];
                break;
            case 2:
                nextCard = suitDiamonds[randomCardTwo];
                break;
            case 3:
                nextCard = suitSpade[randomCardTwo];
                break;
            case 4:
                nextCard = suitHearts[randomCardTwo];
                break;
        }
        historyP.innerHTML = ("The next card will be: " + nextCard);
        console.log("randomSuitOne is: " + randomSuitOne + " randomCardOne is: " + randomCardOne);
        console.log("randomSuitTwo is: " + randomSuitTwo + " randomCardTwo is: " + randomCardTwo);
    }
}

function gamePlay() {

    activeCardValue = activeCard.split(" ");
    activeCardValue = parseInt(activeCardValue.splice(0, 1));
    console.log("activeCardValue is: " + activeCardValue);

    nextCardValue = nextCard.split(" ");
    nextCardValue = parseInt(nextCardValue.splice(0, 1));
    console.log("nextCardValue is: " + nextCardValue);

    if (userGuess == undefined) {
        makeUserGuess();
    } else {
        checkUserGuess();
    }
}

function checkUserGuess() {
    switch (userGuess) {
        case 1: console.log("User clicked HIGHER");
            if (activeCardValue <= nextCardValue) {
                console.log("Case 1: TRUE fired");
                title.innerHTML = "CORRECT!"
                userGuess = undefined;
                setTimeout(cardChoice, 2000);
                console.log(">>>>>>>>>>>>>>>>>>>>>>> GAME CYCLE ENDS, this is cycle: " + gameCycle);
                break;
            } else {
                console.log("Case 1: FALSE fired");
                title.innerHTML = "GAME OVER!"
                userGuess = undefined;
            }
            break;
        case 2: console.log("User clicked LOWER");
            if (activeCardValue >= nextCardValue) {
                console.log("Case 2: TRUE fired - GAME ENDED");
                title.innerHTML = "CORRECT!"
                userGuess = undefined;
                setTimeout(cardChoice, 2000);
                console.log(">>>>>>>>>>>>>>>>>>>>>>> GAME CYCLE ENDS, this is cycle: " + gameCycle);
                break;
            } else {
                console.log("Case 2: FALSE fired - GAME ENDED");
                title.innerHTML = "GAME OVER!"
                userGuess = undefined;
            }
            break;
    }
}

function makeUserGuess() {

    document.querySelector("#high").addEventListener("click", function () { 
        console.log("High button clicked.");
        userGuess = parseInt(this.value); 
        checkUserGuess();
        gamePlay();
    });
    
    document.querySelector("#low").addEventListener("click", function () { 
        console.log("Low button clicked.");
        userGuess = parseInt(this.value); 
        checkUserGuess();
        gamePlay();
    });;

}

makeUserGuess();
