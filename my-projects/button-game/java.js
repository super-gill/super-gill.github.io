
var level = 1;
console.log("Level is: " + level);
var thisButton = this;
console.log("The event button is: " + thisButton);
var randomNumber = Math.floor(Math.random() * 2);
console.log("Random number is :" + randomNumber);
var continueGame = false;
console.log("continue game is: " + continueGame);
var randomPattern = [];
console.log("Random pattern is: " + randomPattern);


pause()
console.log("Call pause");

    function pause() {
        document.querySelector(".paused").innerHTML = ("Game paused! click HERE to continue!");
        if (continueGame == false) {
            document.querySelector(".paused").addEventListener("click", function () {
                continueGame = true;
                document.querySelector(".paused").innerHTML = ("Game running!");
                console.log("Game paused");
                computerPress();
            })
        } else { userClick(); }
    }

    function computerPress() {
        if (continueGame) {
            if (randomNumber === 0) {
                setTimeout(() => {
                    document.querySelector("#one").classList.add("pressed");
                }, 500);
                setTimeout(() => {
                    document.querySelector("#one").classList.remove("pressed");
                }, 600);
            } else {
                setTimeout(() => {
                    document.querySelector("#two").classList.add("pressed");
                }, 500);
                setTimeout(() => {
                    document.querySelector("#two").classList.remove("pressed");
                }, 600);
            }
            randomPattern.push(randomNumber);
            randomNumber = Math.floor(Math.random() * 2);
        }
        continueGame = true; //to prevent continuous clicking to trigger this function
        //userClick();
    }

    function userClick() {
        continueGame = true;
        if (continueGame) {
          let buttons = document.querySelectorAll(".btn");
          for (const button of buttons) {
            button.addEventListener("click", identifyUserClick);
            //   console.log(button);
      
            function identifyUserClick() {
              buttonClicked = this;
              console.log(buttonClicked);
      
              // to apply the animation to show which button was clicked
              if (buttonClicked.classList.contains("red")) {
                buttonClicked.classList.add("pressed");
                setTimeout(() => {
                  buttonClicked.classList.remove("pressed");
                }, 100);
                currentUserClick = 0;
              } else {
                buttonClicked.classList.add("pressed");
                setTimeout(() => {
                  buttonClicked.classList.remove("pressed");
                }, 100);
                currentUserClick = 1;
              }
              //checks for match
              // heckForMatch();
              pause();
            }
          }
        }
      }



// function gameLogic() {

//     console.log("start button detector loop...");

//     for (i = 0; i < 2; i++) {
//         document.querySelectorAll("game-button")[i].addEventListener("click", function () {

//             console.log("Call pause()")
//             pause();


//         })
//     }

// }

