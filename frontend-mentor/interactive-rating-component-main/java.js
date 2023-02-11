for (i = 0; i < 5; i++) {
    document.querySelectorAll(".rating-btn")[i].addEventListener("click", function () {

        var thisButton = parseInt(this.textContent);
        buttonIDIndex = [];
        var buttonID = ["one", "two", "three", "four", "five"];


        switch (thisButton) {
            case 1: modifyButton(); break;
            case 2: modifyButton(); break;
            case 3: modifyButton(); break;
            case 4: modifyButton(); break;
            case 5: modifyButton(); break;
            default: return -1;
        }

        function modifyButton() {
            document.getElementById(buttonID[thisButton - 1]).classList.add("onClick");
            buttonIDIndex = buttonID.indexOf(buttonID[thisButton - 1]);
            buttonID.splice(buttonIDIndex, 1);
            resetOnClick(buttonID);
            console.log(thisButton);
            document.getElementById("scoreNumber").innerHTML = thisButton;
        }

        function resetOnClick(buttonID) {
            for (i = 0; i < 4; i++) {
                document.getElementById(buttonID[i]).classList.remove("onClick");
            }
        }
    })
}