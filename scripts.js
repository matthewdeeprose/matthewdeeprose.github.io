
function menuAction() {
  let x = document.getElementById("myTopnav");
  if (x.className === "topnav") {
    x.className += " responsive";
	document.getElementById('homeMenu').focus();
  } else {
    x.className = "topnav";
  }
}
// Responsive menu hamburger changes
// Set constant
const menu = document.getElementById('menu');
// Functions
function showHamburger() { 
document.getElementById("hamburger").style.display = "inline-block";
document.getElementById("arrow").style.display = "none"; 
	} 
function showArrow() { 
document.getElementById("hamburger").style.display = "none";
document.getElementById("arrow").style.display = "inline-block"; 
	} 
// Use events to change hamburger icon
menu.onmouseover = showArrow; 
menu.onfocus = showArrow; 
menu.onmouseout = showHamburger;
menu.onblur = showHamburger;


let mybutton = document.getElementById("myBtn");
let mybutton2 = document.getElementById("myBtn2");


window.onscroll = function() {
    scrollFunction()
};

function scrollFunction() {
    if (document.body.scrollTop > 660 || document.documentElement.scrollTop > 660) {
        mybutton.style.display = "block";
		mybutton2.style.display = "block";
    } else {
        mybutton.style.display = "none";
		mybutton2.style.display = "none";
    }
}



function topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}

function bottomFunction() {
window.scrollTo(0,document.body.scrollHeight);
}
