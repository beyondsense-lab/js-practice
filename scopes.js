var teacher = "Aditya"; //global scoped variable teacher
function fun(){
  var teacher = "LAURA"; //function scoped variable teacher
  console.log ("hello", teacher); //will print function scoped teacher as the active scope is function fun
}
fun();
