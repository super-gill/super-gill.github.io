// General Variables
var deck = [],
    playHistoryArray = [],
    userGuess,
    activeCard,
    nextCard,
    previousCard,
    guessListenersAdded = false,
    score = "0",
    buttonDisable = false,
    cheatLives,
    activeCardRandomizer,
    nextCardRandomizer, nextCardValue = 'default',
    autoPilotEnable = "false",
    gameCycle = 0,
    initialDeckLength,
    deckLengthCheck;

// AI Memory
var cardValueHistory, lastCardValue, activeCardValue, level;

// HTML object locations
const activeCardIMGLoc = document.querySelector("#activeCardIMG"),
    nextCardIMGLoc = document.querySelector("#nextCardIMG"),
    titleLoc = document.querySelector("#title"),
    playHistoryLoc = document.querySelector("#play-history"),
    lastCardLoc = document.querySelector("#last-card"),
    scoreLoc = document.querySelector("#score"),
    cheatButtonLoc = document.querySelector("#cheat"),
    deckCountLoc = document.querySelector("#deck-count"),
    imgContainerLoc = document.getElementById('img-container'),
    allButtonsLoc = document.querySelectorAll("button"),
    higherButtonLoc = document.querySelector("#high"),
    lowerButtonLoc = document.querySelector("#low");

// Location defaults
titleLoc.innerHTML = "Higher or Lower!";
cheatButtonLoc.innerHTML = "Cheat! (" + cheatLives + ") lives left";
cheat.disabled = true;
activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");
nextCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/red_joker.png");

// Start
gameStart();

// Handle the steps to default the game state
function gameStart() {
    resetGame();
    titleLoc.innerHTML = "Building the deck!";
    scoreBoard("closescoreboard");
    setTimeout(() => buildDeck(), 1000);
}

// Reset the game state to default
function resetGame() {
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
    checkDeckCounterAmount();
}

// build a deck of 52 cards
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
    checkDeckCounterAmount();
    cardChoice();
    if (score === '0') {
        gameStart();
    } else if (deck.length === 0 && score !== 0) {
        gameOver();
    }
}

// Update the deck counter
// this needs to be updated because it isnt compatible with the popup game end window :(
function checkDeckCounterAmount() {
    if (deck.length == 1) {
        deckCountLoc.innerHTML = "Last card!"
    } else if (deck.length == 0) {
        deckCountLoc.innerHTML = "There are 52 cards left in the deck."
    } else {
        deckCountLoc.innerHTML = "There are " + deck.length + " cards left in the deck."
    }
}

// Select a random card for the user to guess the relative value of
function cardChoice() {
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
        nextCardRandomizer = Math.floor((Math.random() * deck.length));
        nextCard = deck[nextCardRandomizer];
        createCardObject()
    }
}

// convert the png name to a numeric value for mathing with
function createCardObject() {
    activeCardValue = activeCard.split(" ");
    activeCardValue = parseInt(activeCardValue.splice(0, 1));
    nextCardValue = nextCard.split(" ");
    nextCardValue = parseInt(nextCardValue.splice(0, 1));
    buttonDisable = false;
    cheat.disabled = false;
    if (autoPilotEnable == true) {
        autoPilot()
    } return;
}

// Trigger the higher guess
function higher() {
    userGuess = 1;
    buttonDisable = true;
    checkUserGuess()
    checkDeckCounterAmount();
}

// Trigger the lower guess
function lower() {
    userGuess = 2;
    buttonDisable = true;
    checkUserGuess()
    checkDeckCounterAmount();
}

// Trigger the cheat option
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

// Compare the users guess to the actual state
function checkUserGuess() {
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

// triggered if the users guess was correct, update the game state
function guessCorrect() {

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

// triggered if the guess was wrong, update the game state
function gameOver() {
    // console.log("gameOver() ran");
    allButtonsLoc.forEach((button) => {
        button.disabled = true;
    })
    titleLoc.innerHTML = (" GAME OVER !");
    activeCardIMGLoc.setAttribute("src", "Assets/PNG-cards-1.3/" + nextCard);
    setTimeout(() => scoreBoard("openscoreboard"), 3000)
}

// Add a life to cheat lives based on [something]
// This could be combined in to something else maybe? pass an option through?
function updateLives() {
    if (score % 3 == 0) {
        cheatLives++;
    }
}

// update the card history with a picture of each card played
function updateHistory(selection) {
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

// Update the points in screen with a witty message for the game end popup
// I need to research a better way of doing this maybe?
function updatePoints() {
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

// Open or close the score board at the end of the game
function scoreBoard(input) {
    // console.log("scoreBoard() ran with the input: " + input);
    switch (input) {
        case "openscoreboard":
            allButtonsLoc.forEach((button) => {
                button.disabled = false;
            })
            document.querySelector("#play-area").classList.add("hidden");
            document.querySelector("#game-over").classList.remove("hidden");
            break;
        case "closeclosescoreboard":
            allButtonsLoc.forEach((button) => {
                button.disabled = false;
            })
            document.querySelector("#play-area").classList.remove("hidden");
            document.querySelector("#game-over").classList.add("hidden");
            break;
    }
}



// AI Profiles:

// Test AI player that plays perfectly
function autoPilot() {
    autoPilotEnable = true;
    allButtonsLoc.forEach((button) => {
        button.disabled = true;
    });

    const intervalId = setInterval(() => {
        if (nextCardValue >= activeCardValue) {
            higherButtonLoc.style.border = "solid";
            clearInterval(intervalId);
            setTimeout(() => {
                higherButtonLoc.style.border = "none";
                higher();
            }, 1000);
        } else if (activeCardValue >= nextCardValue) {
            lowerButtonLoc.style.border = "solid";
            clearInterval(intervalId);
            setTimeout(() => {
                lowerButtonLoc.style.border = "none";
                lower();
            }, 1000);
        }
    }, 1000);
}

// a proper AI that playes the game by guessing
function daniel(level) {
    var dansGuess;
    var debugDecision = [];

    const lowCards = [1, 2, 3, 4];
    const midCards = [5, 6, 7, 8, 9];
    const highCards = [10, 11, 12, 13, 14];

    // fundamental value: the card can not be lower than an ace or higher than a king
    if (activeCardValue == 1) {
        makeAIGuess(1);
        debugDecision.push("stage 1: higher");
    } else if (activeCardValue == 13) {
        makeAIGuess(0);
        debugDecision.push("stage 1: lower");
    }

    // absolute value: the cards value is a fixed constant in the entire set

    // relative value: the cards value is relative to the remaining cards in the deck

    // pattern value #1: an emergent patter informs the value of the next card (ie the last 10 were high do there are less high cards left in the set)


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