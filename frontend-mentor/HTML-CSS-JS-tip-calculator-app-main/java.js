const tipButtons = document.getElementsByClassName("tip").length;

// Locations
const billAmountInput = document.getElementsByClassName("bill-input");
const tipAmountTotal = document.getElementsByClassName("total-tip");


var customTipInput = 0;
var peopleAmount = 0;
var tipCustomAmount = 0;

var total

function billTotalTip() {
    total = document.getElementsByClassName("bill-input").value;
    document.getElementsByClassName("total-tip").innerHTML = total;
};






// getBillValue();

// for (i = 0; i < tipButtons; i++) {

//     if (tipCustomAmount <= 0) {

//         document.getElementsByClassName("tip")[i].addEventListener("click", function () {
//             var buttonNumericalValue = this.innerHTML;
//             buttonNumericalValue = buttonNumericalValue.split("");
//             console.log(buttonNumericalValue);
//             buttonNumericalValue.pop();
//             buttonNumericalValue = buttonNumericalValue.join('');
//             buttonNumericalValue = buttonNumericalValue / 100;
//             console.log(buttonNumericalValue);
//         })
//     } else {

//     }
// };

// function getBillValue() {}

// function tipCorrection() { };



// function tipTotal(billAmount, peopleAmount, tipAmount) { };