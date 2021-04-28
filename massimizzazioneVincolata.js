var Constrained = require('constrained');
var myObject1 = { a: 0, b: 0 };
var myObject2 = { c: 100 };
 
// Instantiation of the system
var mySystem = new Constrained.System();
 
// Instantiation of the variables and the constant
mySystem.addVariable('x', myObject1, 'a'); // variable named x
mySystem.addVariable('y', myObject1, 'b'); // variable named y
mySystem.addConstant('c', myObject2, 'c'); // constant named c
 
// Definition of the system
mySystem.addConstraint('x + y = c').addConstraint('x - y > 0');


// Solving the system to obtain a feasible solution
mySystem.resolve();
 
// Displaying the result
mySystem.log(); // x + y = 100
 
// Making sure that objects have been updated
console.log('(x, y) = (', myObject1.a, ',', myObject1.b, ')');