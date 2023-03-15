var deck = [];
var playHistoryArray = [];
var userGuess = undefined;
var activeCard;
var nextCard;
var previousCard;
var guessListenersAdded = false;
var score = "0";
var buttonDisable = false;
var cheatLives;
var activeCardRandomizer;
var nextCardRandomizer;
var activeCardValue;
var nextCardValue = 'default';
var autoPilotEnable = "false";
var gameCycle = 0;
var initialDeckLength;
var deckLengthCheck;

var level

const activeCardIMGLoc = document.querySelector("#activeCardIMG");
const nextCardIMGLoc = document.querySelector("#nextCardIMG");
const titleLoc = document.querySelector("#title");
const playHistoryLoc = document.querySelector("#play-history");
const lastCardLoc = document.querySelector("#last-card");
const scoreLoc = document.querySelector("#score");
const cheatButtonLoc = document.querySelector("#cheat");
const deckCountLoc = document.querySelector("#deck-count");
const imgContainerLoc = document.getElementById('img-container');
const allButtonsLoc = document.querySelectorAll("button");
const higherButtonLoc = document.querySelector("#high")
const lowerButtonLoc = document.querySelector("#low")

titleLoc.innerHTML = "Higher or Lower!"
cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left"
cheat.disabled = true;
activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");
nextCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");

buildDeck();

function autoPilot() {
    // for testing, play a perfect game without any "guessing"
    // console.log("autoPilot() ran");
    autoPilotEnable = true;
    allButtonsLoc.forEach((button) => {
        button.disabled = true;
    })
    const intervalId = setInterval(() => {
        if (nextCardValue >= activeCardValue) {
            clearInterval(intervalId);
            higher();
        } else if (activeCardValue >= nextCardValue) {
            clearInterval(intervalId);
            lower();
        }
    }, 1000);
}

function daniel(level) {
    var dansGuess;
    var debugDecision = [];

    // if the card is an Ace or a king, always choose higher or lower correspondingly
    if (activeCardValue == 1) {
        makeAIGuess(1);
        debugDecision.push("stage 1: higher");
    } else if (activeCardValue == 13) {
        makeAIGuess(0);
        debugDecision.push("stage 1: lower");
    }


    //if the previous card was an ace and the current card is not a king choose higher


    function makeAIGuess(dansGuess) {
        switch (dansGuess) {
            case 1:
                higher();
                break;
            case 0:
                lower();
                break;
        } return;
    } return;

}

function gameStart() {
    // console.log("gameStart() ran");
    resetGame();
    titleLoc.innerHTML = "Building the deck!";
    scoreBoard("closescoreboard");
    setTimeout(() => buildDeck(), 1000);
}

function checkDeckCounterAmount() {
    // console.log("checkDeckCounterAmount() ran");
    if (deck.length == 1) {
        deckCountLoc.innerHTML = "Last card!"
    } else if (deck.length == 0) {
        deckCountLoc.innerHTML = "There are 52 cards left in the deck."
    } else {
        deckCountLoc.innerHTML = "There are " + deck.length + " cards left in the deck."
    }
}

function updatePoints() {
    // console.log("updatePoints() ran");
    if (score != 0 && score - 1 % 5 == 0) {
        scoreLoc.innerHTML = "Get another one right and ill give you another cheat life!"
    }
    if (score >= 0 && score <= 5) {
        scoreLoc.innerHTML = "Wow, you got a score of " + score + ", and they say monkeys can't use computers."
    } else if (score >= 6 && score <= 10) {
        scoreLoc.innerHTML = "A score of " + score + "? Maybe you should try tic-tac-toe instead."
    } else if (score >= 11 && score <= 15) {
        scoreLoc.innerHTML = "I mean, a score of " + score + " is impressive... for a baby."
    } else if (score >= 16 && score <= 20) {
        scoreLoc.innerHTML = "Well done! Your score of " + score + " is enough to impress your cat."
    } else if (score >= 21 && score <= 25) {
        scoreLoc.innerHTML = "Your score of " + score + " is more impressive than your dancing skills."
    } else if (score >= 26 && score <= 30) {
        scoreLoc.innerHTML = "You scored " + score + "? You must have a lucky rabbit's foot."
    } else if (score >= 31 && score <= 35) {
        scoreLoc.innerHTML = "Your score of " + score + " is almost as impressive as my mom's lasagna recipe."
    } else if (score >= 36 && score <= 40) {
        scoreLoc.innerHTML = "I can't believe it! A score of " + score + " and you didn't even cheat."
    } else if (score >= 41 && score <= 45) {
        scoreLoc.innerHTML = "A score of " + score + " is just one step away from world domination."
    } else if (score >= 46 && score <= 50) {
        scoreLoc.innerHTML = "Your score of " + score + " is impressive, but can you do it with your eyes closed?"
    } else if (score >= 51) {
        scoreLoc.innerHTML = "HOLY CRAP ARE YOU SOME KIND OF GOD!? " + score
    }
}

function updateHistory(selection) {
    // console.log("checkDeckCounterAmount() ran with the input: " + selection);
    switch (selection) {
        case "add":
            const img = document.createElement('img');
            img.src = "Assets/PNG-cards-1.3/" + activeCard;
            img.style.width = "8%";
            imgContainerLoc.appendChild(img);
            break;
        case "remove":
            imgContainerLoc.querySelector("#image-container");
            while (imgContainerLoc.firstChild) {
                imgContainerLoc.removeChild(imgContainerLoc.firstChild);
            }
    }
}

function buildDeck() {
    const suits = {
        diamonds: "Diamonds",
        hearts: "Hearts",
        clubs: "Clubs",
        spades: "Spades"
    };

    const cards = [];
    for (let i = 1; i <= 13; i++) {
        for (const suit in suits) {
            const card = i + "_of_" + suits[suit] + ".png";
            cards.push(card);
        }
    }
    deck = cards;
    checkDeckCounterAmount(); // make sure this function is defined
    cardChoice(); // make sure this function is defined
    if (score === '0') {
        gameStart();
    } else if (deck.length === 0 && score !== 0) {
        gameOver();
    }
}

function cardChoice() {
    // console.log("cardChoice() ran");
    titleLoc.innerHTML = "Make your guess: Higher or Lower!"
    userGuess = undefined;
    updatePoints()
    activeSequenceCard();

    function activeSequenceCard() {
        if (nextCardValue == 'default') {
            activeCard = deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
            console.log("activeCard is: " + activeCard + " and there are " + deck.length + " cards left in the deck")
        } else {
            activeCard = nextCard;
        }

        activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + activeCard);
        nextSequenceCard();
    }

    function nextSequenceCard() {
        // console.log("nextSequenceCard() ran");
        nextCardRandomizer = Math.floor((Math.random() * deck.length));
        nextCard = deck[nextCardRandomizer];
        createCardObject()
    }
}

function createCardObject() {
    // console.log("createCardObject() ran");
    activeCardValue = activeCard.split(" ");
    activeCardValue = parseInt(activeCardValue.splice(0, 1));
    nextCardValue = nextCard.split(" ");
    nextCardValue = parseInt(nextCardValue.splice(0, 1));
    buttonDisable = false;
    cheat.disabled = false;
    if (autoPilotEnable == true) {
        //setTimeout(() => autoPilot(), 1000)
        autoPilot()
    } return;
}

function higher() {
    userGuess = 1;
    buttonDisable = true;
    checkUserGuess()
    checkDeckCounterAmount();
}


function lower() {
    userGuess = 2;
    buttonDisable = true;
    checkUserGuess()
    checkDeckCounterAmount();
}

function cheatTurn() {
    // console.log("cheatTurn() ran");
    if (cheatLives > 0) {
        cheat.disabled = true;
        if (activeCardValue >= nextCardValue) {
            cheat.innerHTML = "LOWER!"
        } else {
            cheat.innerHTML = "HIGHER!"
        }
        cheatLives--;
    } else {
        cheat.innerHTML = "ALL OUTTA LIVES!";
    }
}




function checkUserGuess() {
    // console.log("checkUserGuess() ran");
    if (userGuess == false) {
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

function updateLives() {
    // console.log("updateLives() ran");
    if (score % 3 == 0) {
        cheatLives++;
    }
}

function guessCorrect() {
    // console.log("guessCorrect() ran");

    //initialize the correct guess game state
    titleLoc.innerHTML = "CORRECT!"
    nextCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + activeCard);
    gameHistory.push(" " + activeCard);
    initialDeckLength = deck.length;

    //check if this is the last card and if it is build a new deck and stop executing guessCorrect
    if (deck.length == 1) {
        setTimeout(() => gameOver(), 1000);
        return;
    }

    //update the correct guess game state
    deck.splice(activeCardRandomizer, 1);
    updateHistory("add");
    score++;
    updateLives();
    cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left"
    updatePoints();
    activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + nextCard);
    console.log("Next card is: " + nextCard);

    //update the game cycle
    gameCycle++
    console.log("Game cycle: " + gameCycle + " <-----------------")

    //end the correct guess game state and continue the game
    setTimeout(() => cardChoice(), 1000);
}

function gameOver() {
    // console.log("gameOver() ran");
    allButtonsLoc.forEach((button) => {
        button.disabled = true;
    })
    titleLoc.innerHTML = (" GAME OVER !");
    activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + nextCard);
    setTimeout(() => scoreBoard("openscoreboard"), 3000)
}

function scoreBoard(input) {
    // console.log("scoreBoard() ran with the input: " + input);
    switch (input) {
        case "openscoreboard":
            document.querySelector("#play-area").classList.add("hidden");
            document.querySelector("#game-over").classList.remove("hidden");
            break;
        case "closeclosescoreboard":
            document.querySelector("#play-area").classList.remove("hidden");
            document.querySelector("#game-over").classList.add("hidden");
            break;
    }
}

function resetGame() {
    // console.log("resetGame() ran");
    allButtonsLoc.forEach((button) => {
        button.disabled = false;
    })

    document.querySelector("#play-area").classList.remove("hidden");
    document.querySelector("#game-over").classList.add("hidden");
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
    score = 0;
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