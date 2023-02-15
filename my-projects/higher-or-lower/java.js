var suitClubs = [];
var suitDiamonds = [];
var suitHearts = [];
var suitSpade = [];
var history = [];
var userGuess;
var activeCard;
var nextCard;

var randomSuitOne;
var randomCardOne;
var randomSuitTwo;
var randomCardTwo;

var activeCardValue;
var nextCardValue;


const card = document.querySelector(".card");
const title = document.querySelector(".title");
const historyP = document.querySelector(".history-p");


console.log("Called buildDeck");
buildDeck();


function buildDeck() {
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
    console.log("Built the deck, called cardChoice");
    cardChoice();
};

function cardChoice() {
    console.log("Change title to Higher or Lower!");
    title.innerHTML = "Higher or Lower!"

    console.log("Call activeSequenceCard");
    activeSequenceCard();

    function activeSequenceCard() {
        randomSuitOne = Math.floor((Math.random() * 4)+1);
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
        console.log("Call nextSequenceCard");
        nextSequenceCard();
    }

    function nextSequenceCard() {
        randomSuitTwo = Math.floor((Math.random() * 4)+1);
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
        console.log("Call gamePlay")
        gamePlay();

    }



    console.log("At the end of cardSelection, activeCard is: " + activeCard);

}

function gamePlay() {
    console.log("Create game loop");

    for (i = 0; i < 2; i++) {

        document.getElementsByClassName("game-button")[i].addEventListener("click", function () {

            activeCardValue = activeCard.split(" ");
            activeCardValue.splice(1, 1);
            console.log("activeCardValue is:" + activeCardValue)

            nextCardValue = nextCard.split(" ");
            nextCardValue.splice(1, 1);
            console.log("nextCardValue is:" + nextCardValue)

            userGuess = parseInt(this.value);
            console.log("The user clicked button (1=higher 2=lower): " + userGuess);

            switch (parseInt(userGuess)) {
                case 1:
                    if (parseInt(activeCardValue) >= parseInt(nextCardValue)) {

                        console.log("User selection was correct");

                        console.log("change title to CORRECT!");
                        title.innerHTML = "CORRECT!"

                        console.log("wait 5 seconds");
                        setTimeout(cardChoice, 2000);

                    } else {
                        console.log("User selection was wrong, game ended");

                        title.innerHTML = "GAME OVER!"
                    }
                    break;

                case 2:
                    if (parseInt(activeCardValue) <= parseInt(nextCardValue)) {

                        console.log("User selection was correct");

                        console.log("change title to CORRECT!");
                        title.innerHTML = "CORRECT!"

                        console.log("wait 5 seconds");
                        setTimeout(cardChoice, 2000);
                    } else {
                        console.log("User selection was wrong, game ended");

                        title.innerHTML = "GAME OVER!"
                    }
                    break;
            }
        })
    }
}





