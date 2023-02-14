let randomNumber = Math.floor(Math.random() * 2);
let continueGame = true;
let level = 0;
let randomPattern = [];
let currentUserClick;
let buttonClicked;

pressAnyKey();

function pressAnyKey() {
  if (continueGame) {
    document.addEventListener(
      "click",
      () => {
        computerPress();
        setTimeout(() => {
          document.querySelector(
            "h1"
          ).innerHTML = `Click what the computer pressed:
            Level ${level}`;
        }, 1500);
      },
      { once: true }
    );
  }
}

function computerPress() {
  if (continueGame) {
    if (randomNumber === 0) {
      setTimeout(() => {
        document.querySelector(".red").classList.add("pressed");
      }, 500);
      setTimeout(() => {
        document.querySelector(".red").classList.remove("pressed");
      }, 600);
    } else {
      setTimeout(() => {
        document.querySelector(".blue").classList.add("pressed");
      }, 500);
      setTimeout(() => {
        document.querySelector(".blue").classList.remove("pressed");
      }, 600);
    }
    randomPattern.push(randomNumber);
    randomNumber = Math.floor(Math.random() * 2);
  }
  continueGame = false; //to prevent continuous clicking to trigger this function
  userClick();
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
        checkForMatch();
      }
    }
  }
}

function checkForMatch() {
  if (currentUserClick === randomPattern[level]) {
    if (level > 1) {
      console.log("correct");
    } else {
      console.log("correct");
      level = ++level;
      document.querySelector("h1").innerHTML = `Click what the computer pressed:
            Level ${level}`;
      //   button.removeEventListener("click", identifyUserClick);
    }
  } else {
    console.log("Game over");
    // button.removeEventListener("click", identifyUserClick);
  }
}
