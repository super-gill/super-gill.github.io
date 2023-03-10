var suitClubs = [];
var suitDiamonds = [];
var suitHearts = [];
var suitSpade = [];
var deck = [];
var playHistoryArray = [];
var userGuess = undefined;
var activeCard;
var nextCard;
var previousCard;
var guessListenersAdded = false;
var score = '0';
var buttonDisable = false;
var cheatLives = 0;
var activeCardRandomizer;
var nextCardRandomizer;
var activeCardValue;
var nextCardValue = 'default';

const activeCardIMGLoc = document.querySelector("#activeCardIMG");
const nextCardIMGLoc = document.querySelector("#nextCardIMG");
const titleLoc = document.querySelector("#title");
const playHistoryLoc = document.querySelector("#play-history");
const lastCardLoc = document.querySelector("#last-card");
const scoreLoc = document.querySelector("#score");
const cheatButtonLoc = document.querySelector("#cheat");
const deckCountLoc = document.querySelector("#deck-count");
const imgContainerLoc = document.getElementById('img-container');

titleLoc.innerHTML = "Higher or Lower!"
cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left"
cheat.disabled = true;
//playHistoryLoc.innerHTML = "Previous cards will appear here!";

activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");
nextCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");

buildDeck();

function gameStart() {
    resetGame();
    titleLoc.innerHTML = "Building the deck!";
    score = 0;
    setTimeout(buildDeck, 2000);
}

function updateStats() {
    // points
    // deck count
}

function checkDeckCounterAmount() {
    if (deck.length == 1) {
        deckCountLoc.innerHTML = "Last card!"
    } else if (deck.length == 0) {
        deckCountLoc.innerHTML = "There are 52 cards left in the deck."
    } else {
        deckCountLoc.innerHTML = "There are " + deck.length + " cards left in the deck."

    }
}

function updatePoints() {
    if (score != 0 && score - 1 % 5 == 0) {
        scoreLoc.innerHTML = "Get another one right and ill give you another cheat life!"
    }
    if (score > 0 && score < 5) {
        scoreLoc.innerHTML = "Wow, you got a score of " + score + ", and they say monkeys can't use computers."
    } else if (score > 6 && score < 10) {
        scoreLoc.innerHTML = "A score of " + score + "? Maybe you should try tic-tac-toe instead."
    } else if (score > 11 && score < 15) {
        scoreLoc.innerHTML = "I mean, a score of " + score + " is impressive... for a baby."
    } else if (score > 16 && score < 20) {
        scoreLoc.innerHTML = "Well done! Your score of " + score + " is enough to impress your cat."
    } else if (score > 21 && score < 25) {
        scoreLoc.innerHTML = "Your score of " + score + " is more impressive than your dancing skills."
    } else if (score > 26 && score < 30) {
        scoreLoc.innerHTML = "You scored " + score + "? You must have a lucky rabbit's foot."
    } else if (score > 31 && score < 35) {
        scoreLoc.innerHTML = "Your score of " + score + " is almost as impressive as my mom's lasagna recipe."
    } else if (score > 36 && score < 40) {
        scoreLoc.innerHTML = "I can't believe it! A score of " + score + " and you didn't even cheat."
    } else if (score > 41 && score < 45) {
        scoreLoc.innerHTML = "A score of " + score + " is just one step away from world domination."
    } else if (score > 46 && score < 50) {
        scoreLoc.innerHTML = "Your score of " + score + " is impressive, but can you do it with your eyes closed?"
    } else if (score > 51) {
        scoreLoc.innerHTML = "HOLY CRAP ARE YOU SOME KIND OF GOD!? " + score
    }
}

function updateHistory(selection) {
    switch (selection) {
        case "add":
            const img = document.createElement('img');
            img.src = "Assets/PNG-cards-1.3/" + activeCard;
            img.style.width = "8%";
            imgContainerLoc.appendChild(img);
            break;
        case "remove":
            // Select the div
            imgContainerLoc.querySelector("#image-container");

            // Remove all the child elements of the div
            while (imgContainerLoc.firstChild) {
                imgContainerLoc.removeChild(imgContainerLoc.firstChild);
            }
    }
}

function buildDeck() {
    checkDeckCounterAmount();
    if (score === '0' ?? deck.length == 0) {
        gameStart();
    } else {
        let i;
        for (i = 1; i <= 13; i++) {
            suitDiamonds.push(i + "_of_diamonds.png");
        }
        for (i = 1; i <= 13; i++) {
            suitHearts.push(i + "_of_hearts.png");
        }
        for (i = 1; i <= 13; i++) {
            suitClubs.push(i + "_of_clubs.png");
        }
        for (i = 1; i <= 13; i++) {
            suitSpade.push(i + "_of_spades.png");
        }
        deck = suitClubs.concat(suitDiamonds, suitHearts, suitSpade);
        checkDeckCounterAmount()
        cardChoice();
    }
};

function cardChoice() {
    titleLoc.innerHTML = "Make your guess: Higher or Lower!"
    userGuess = undefined;
    updatePoints()
    activeSequenceCard();

    function activeSequenceCard() {

        if (nextCardValue == 'default') {
            activeCardRandomizer = Math.floor((Math.random() * deck.length));
            activeCard = deck[activeCardRandomizer];
        } else {
            activeCard = nextCard;
            nextSequenceCard();
        }

        activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + activeCard);
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
    cheat.disabled = false;
    // do nothing
}

function higher() {
    cheat.disabled = true;
    if (buttonDisable == true) {
        // do nothing
    } else {
        userGuess = 1;
        buttonDisable = true;
        checkUserGuess()
        checkDeckCounterAmount();
    }
}

function lower() {
    cheat.disabled = true;
    if (buttonDisable == true) {
        // do nothing
    } else {
        userGuess = 2;
        buttonDisable = true;
        checkUserGuess()
        checkDeckCounterAmount();
    }
}



function cheatTurn() {
    if (cheatLives > 0) {
        cheat.disabled = true;
        cheat.innerHTML = nextCard;
        cheatLives--;
    } else {
        cheat.innerHTML = "ALL OUTTA LIVES!";
    }
}

function checkUserGuess() {
    if (userGuess == false) {
        // do nothing
    } else {
        switch (userGuess) {
            case 1:
                if (nextCardValue >= activeCardValue) {
                    guessCorrect()
                    break;
                } else {
                    gameOver();
                }
                break;
            case 2:
                if (activeCardValue >= nextCardValue) {
                    guessCorrect()
                    break;
                } else {
                    cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left"
                    gameOver();
                }
                break;
        }
    }
}

function guessCorrect() {
    titleLoc.innerHTML = "CORRECT!"
    userGuess = undefined;
    nextCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + activeCard);
    gameHistory.push(" " + activeCard);
    deck.splice(activeCardRandomizer, 1);
    updateHistory("add");
    //playHistoryLoc.innerHTML = gameHistory;
    cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left"
    if (score - 1 % 5 == 0) {
        cheatLives++;
    }
    score++;
    updatePoints();
    activeCardIMGLoc.setAttribute("src", "");
    setTimeout(cardChoice, 2000);
}

function gameOver() {
    titleLoc.innerHTML = (" GAME OVER !");
    activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + nextCard);
    // cardLoc.innerHTML = ("The next card was:<br>" + nextCard + "<br>Your score was: " + score);
    setTimeout(gameStart, 5000)
}

function resetGame() {
    activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");
    nextCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");
    suitClubs = [];
    suitDiamonds = [];
    suitHearts = [];
    suitSpade = [];
    deck = [];
    gameHistory = [];
    userGuess = undefined;
    activeCard;
    nextCard;
    previousCard;
    guessListenersAdded = false;
    score = '0';
    buttonDisable = false;
    cheatLives = 3;
    activeCardRandomizer;
    nextCardRandomizer;
    activeCardValue;
    nextCardValue = 'default';
    updateHistory("remove");
    cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left"
    updatePoints();
    //cardLoc.innerHTML = "No card drawn yet!";
    checkDeckCounterAmount();
}