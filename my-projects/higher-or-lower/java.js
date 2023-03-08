var suitClubs = [];
var suitDiamonds = [];
var suitHearts = [];
var suitSpade = [];
var deck = [];
var gameHistory = [];
var userGuess = undefined;
var activeCard;
var nextCard;
var previousCard;
var guessListenersAdded = false;
var score = '-1';

var activeCardRandomizer = 0;
var nextCardRandomizer = 0;

var activeCardValue;
var nextCardValue = 'default';

var gameCycle = 0;

const card = document.querySelector(".card");
const title = document.querySelector(".title");
const historyP = document.querySelector(".history-p");
const deckOutput = document.querySelector("#deck");
const lastCardOut = document.querySelector("#last-card");


buildDeck();

function gameStart() {
    title.innerHTML = "Welcome to Higher or Lower!";
    score = 0;
    setTimeout(buildDeck, 5000);
}

function buildDeck() {
    if (score == '-1') {
        gameStart();
    } else {

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
        deck = suitClubs.concat(suitDiamonds, suitHearts, suitSpade);
        cardChoice();
    } deckOutput.innerHTML = gameHistory;
};

function cardChoice() {
    gameCycle = gameCycle + 1;
    title.innerHTML = "Higher or Lower!"
    userGuess = undefined;
    activeSequenceCard();

    function activeSequenceCard() {

        if (nextCardValue == 'default') {
            activeCardRandomizer = Math.floor((Math.random() * deck.length));
            activeCard = deck[activeCardRandomizer];
        } else {
            activeCard = nextCard;
            nextSequenceCard();
        }

        card.innerHTML = activeCard;
        nextSequenceCard();
    }

    function nextSequenceCard() {      
        nextCardRandomizer = Math.floor((Math.random() * deck.length));
        nextCard = deck[nextCardRandomizer];
        console.log("The next card will be: " + nextCard);        
    }
}

function createCardObject() {
    if (userGuess == undefined) {
        makeUserGuess();
    } else {
        activeCardValue = activeCard.split(" ");
        activeCardValue = parseInt(activeCardValue.splice(0, 1));
        nextCardValue = nextCard.split(" ");
        nextCardValue = parseInt(nextCardValue.splice(0, 1));
        checkUserGuess();
    }
}

function makeUserGuess() {
    if (!guessListenersAdded) {
        document.querySelector("#high").addEventListener("click", function () {
            userGuess = parseInt(this.value);
            createCardObject();
        });

        document.querySelector("#low").addEventListener("click", function () {
            userGuess = parseInt(this.value);
            createCardObject();
        });
        guessListenersAdded = true;
    }

}

function checkUserGuess() {
    switch (userGuess) {
        case 1:
            if (nextCardValue >= activeCardValue) {
                title.innerHTML = "CORRECT!"
                document.querySelector("#high").removeEventListener("click", makeUserGuess);
                document.querySelector("#low").removeEventListener("click", makeUserGuess);
                userGuess = undefined;
                lastCardOut.innerHTML = activeCard;
                gameHistory.push(" "+activeCard);
                deck.splice(activeCardRandomizer, 1);
                deckOutput.innerHTML = gameHistory;
                guessListenersAdded = false;
                setTimeout(cardChoice, 2000);
                break;
            } else {
                title.innerHTML = "GAME OVER!"
            }
            break;
        case 2:
            if (activeCardValue >= nextCardValue) {
                title.innerHTML = "CORRECT!"
                document.querySelector("#high").removeEventListener("click", makeUserGuess);
                document.querySelector("#low").removeEventListener("click", makeUserGuess);
                userGuess = undefined;
                lastCardOut.innerHTML = activeCard;
                gameHistory.push(" "+activeCard);
                deck.splice(activeCardRandomizer, 1);
                deckOutput.innerHTML = gameHistory;
                guessListenersAdded = false;
                setTimeout(cardChoice, 2000);
                break;
            } else {
                gameOver()
            }
            break;
    }
}

function gameOver() {
    title.innerHTML = (" GAME OVER !")
    document.querySelector("#high").removeEventListener("click", makeUserGuess);
    document.querySelector("#low").removeEventListener("click", makeUserGuess);
}

makeUserGuess();