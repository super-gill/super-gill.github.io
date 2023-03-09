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
var score = '0';
var buttonDisable = false;
var cheatLives = 3;

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
const scoreHTML = document.querySelector("#score");
const cheatLivesRemaining = document.querySelector("#livesRemaining");
const deckCounter = document.querySelector("#deck-count");
const scoreBoard = document.querySelector("#scoreboard");
cheatLivesRemaining.innerHTML = (cheatLives);
scoreHTML.innerHTML = score;


buildDeck();

function gameStart() {
    title.innerHTML = "Welcome to Higher or Lower!";
    score = 0;
    setTimeout(buildDeck, 2000);
}

function buildDeck() {
    if (score === '0' ?? deck.length == 0) {
        gameStart();
    } else {
        let i;
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
        deckCounter.innerHTML = deck.length;
        cardChoice();
    } deckOutput.innerHTML = "Previous cards will appear here!";
};

function cardChoice() {
    gameCycle = gameCycle + 1;
    title.innerHTML = "Make your guess: Higher or Lower!"
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
        createCardObject()
    }
}

function createCardObject() {
    activeCardValue = activeCard.split(" ");
    activeCardValue = parseInt(activeCardValue.splice(0, 1));
    nextCardValue = nextCard.split(" ");
    nextCardValue = parseInt(nextCardValue.splice(0, 1));
    buttonDisable = false;
    // do nothing
}

function higher() {
    if (buttonDisable == true) {
        // do nothing
    } else {
        userGuess = 1;
        buttonDisable = true;
        checkUserGuess()
        deckCounter.innerHTML = deck.length;
    }
}

function lower() {
    if (buttonDisable == true) {
        // do nothing
    } else {
        userGuess = 2;
        buttonDisable = true;
        checkUserGuess()
        deckCounter.innerHTML = deck.length;
    }
}

function cheatTurn() {
    if (cheatLives > 0) {
        cheatLivesRemaining.innerHTML = nextCard;
        cheatLives--
    } else {
        cheatLivesRemaining.innerHTML = "ALL OUTTA LIVES!";
    }
}

function checkUserGuess() {
    if (userGuess == false) {
        // do nothing
    } else {
        switch (userGuess) {
            case 1:
                if (nextCardValue >= activeCardValue) {
                    title.innerHTML = "CORRECT!"
                    userGuess = undefined;
                    lastCardOut.innerHTML = activeCard;
                    gameHistory.push(" " + activeCard);
                    deck.splice(activeCardRandomizer, 1);
                    deckOutput.innerHTML = gameHistory;
                    guessListenersAdded = false;
                    score++;
                    scoreHTML.innerHTML = score;
                    cheatLivesRemaining.innerHTML = (cheatLives);
                    setTimeout(cardChoice, 2000);
                    break;
                } else {
                    gameOver();
                }
                break;
            case 2:
                if (activeCardValue >= nextCardValue) {
                    title.innerHTML = "CORRECT!"
                    userGuess = undefined;
                    lastCardOut.innerHTML = activeCard;
                    gameHistory.push(" " + activeCard);
                    deck.splice(activeCardRandomizer, 1);
                    deckOutput.innerHTML = gameHistory;
                    guessListenersAdded = false;
                    score++;
                    scoreHTML.innerHTML = score;
                    cheatLivesRemaining.innerHTML = (cheatLives);
                    setTimeout(cardChoice, 2000);
                    break;
                } else {
                    gameOver();
                }
                break;
        }
    }
}

function gameOver() {
    title.innerHTML = (" GAME OVER !");
    card.innerHTML = ("The next card was:<br>" + nextCard + "<br>Your score was: " + score);
}