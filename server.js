var express = require("express");
var logfmt = require("logfmt");
var mongoose = require('mongoose');
var config = require("./config");
var User = require('./models/user');
var Item = require('./models/item');
var Receipt = require('./models/receipt');
var bodyParser = require('body-parser');
var moment = require('moment');
var app = express();
mongoose.connect(config.mongoUri);
app.use(logfmt.requestLogger());
app.use(bodyParser());

//Email parameter
app.param('email', function(req, res, next, email) {
    req.email = email;
    next();
});
//Barcode parameter
app.param('scanContent', function(req, res, next, scanContent) {
    req.scanContent = scanContent;
    next();
});

//Test GET request
app.get('/', function (req, res) {
	res.status(200);
    res.json("Welcome to the hoarder application server!");
});

//##########################################################################################//
//                                Payment                                                   //
//##########################################################################################//

app.post('/payment', function (req, res) {
    var payment = {
        "amount": req.body.amount,
        "description": "Hoarder Payment",
        "card": {
            "expMonth": req.body.expMonth,
            "expYear": req.body.expYear,
            "cvc": req.body.cvc,
            "number": req.body.number
        },
        "currency": "EUR"
    };
    config.SimplifyPay.payment.create(payment, function (errData, data) {
        if (errData) {
            console.log(errData);
            console.log(data);
            //Status code of 400 to allow application to detect payment issues
            res.status(400);
            res.json({code: "400", message: errData.data.error.fieldErrors});
            console.log(errData.data.error.fieldErrors);
            console.error("Error Message: " + errData.data.error.message);
            return;
        }else {
            res.status(200);
            res.json({code: "200", message: "Payment Successful"})
        }
        console.log("Payment Status: " + data.paymentStatus);
    });
});

//##########################################################################################//
//                                User Creation                                             //
//##########################################################################################//
app.post('/user', function (req, res) {
    var user = new User();
    if (!req.body.email || !req.body.password || !req.body.name) {
        var error_message = {
            code: '400',
            message: 'You must have a valid email along with a password and name to create an account!'
        };
		res.status(400);
        res.send(error_message);
    } else {
        User.find({email: req.body.email}, function (err, users) {	// Check users in the DB for the same email
            if (users.length > 0) {
                res.status(400);
                res.json({code: '400', message: 'E-mail already exists!'});
            } else {
                user.name = req.body.name;
                user.password = req.body.password;
                user.email = req.body.email;
                user.phoneNumber = req.body.phoneNumber;
                user.address = req.body.address;
				user.credit = 0;


                user.save(function (err) {
                    if (err) {
                        res.send(err);
                    }
                    res.status(200);
                    res.json({code: "200", message: 'User account created successfully'});
                });
            }
        });
    }
});

//##########################################################################################//
//                                Login                                                     //
//##########################################################################################//
app.post('/login', function (req, res) {
    if (!req.body.password || !req.body.email) {
        res.status(400);
        res.json({code: "400", message: "You must have a valid email and password"});
    } else {
        console.log(req.body);
        User.find({email: req.body.email, password: req.body.password}, function (err, users) {
            if (err) {
                res.json({code: "502", message: "Cannot connect to the database!"});
            } else {
                if (users.length == 1) {
                    //successful login response
                    if (req.body.password == users[0].password) {
                        res.status(200);
                        res.json({code: "200", message: "Welcome back " + users[0].name});
                    } else {
                        res.status(400);
                        res.json({code: "400", message: "Error, invalid login"});
                    }
                } else {
                    res.status(404);
                    res.json({message: "No account found with those credentials. Please try again!"});
                }
            }
        });
    }
});

//##########################################################################################//
//                                Find user by email                                        //
//##########################################################################################//
app.get('/user/:email', function(req, res) {
    var user = new User();
    user.email = req.email;
    User.find({email: user.email}, function (err, users){
        if(users.length > 0){
            res.status(200);
            var first=users[0];
            res.json(first);
        }
        else{
            res.status(400);
            res.json({message: 'A user with that email address has not been registered. Please try again!!'});
        }
    });
});

//##########################################################################################//
//                                Update credit by email                                    //
//##########################################################################################//
app.post('/credit/:email', function(req, res) {
    var user = new User();
    user.email = req.email;
    User.find({email: user.email}, function (err, users) {
        if (users.length > 0) {
            res.status(200);
            var first = users[0];
            if (req.body.credit) {
                if(isNaN(req.body.credit)) {
                    res.status(400);
                    res.json({message: 'Invalid credit value please try again!!'});
                }else{
                    total = first.credit + req.body.credit;
                    first.credit = total;
                    first.save(function (err) {
                        if (err) {
                            res.send(err);
                        }
                        res.status(200);
                        res.json({code: "200", message: 'Credit successfully loaded!!'});
                    });
                }
            } else {
                res.status(400);
                res.json({message: 'Invalid fields.',hint:'Ensure you have filled in the "credit" field'});
            }
        } else {
            res.status(400);
            res.json({message: 'Error updating credit!! Invalid User!!'});
        }
    });
});

//##########################################################################################//
//                                Add item to catalogue                                     //
//##########################################################################################//

app.post('/addItem', function (req, res) {
    var item = new Item();
    if (!req.body.productName||!req.body.productPrice||!req.body.scanContent) {
        res.status(400);
        var error_message = {
            code: '400',
            message: 'Invalid product. Please try again'
        };
        res.send(error_message);
    } else {
        Item.find({productName: req.body.productName}, function (err, items) {
            if (items.length > 0) {
                res.status(400);
                res.json({code: '400', message: 'product is already registered'});
            } else {
                item.productName = req.body.productName;
                item.productPrice = req.body.productPrice;
                item.scanContent = req.body.scanContent;
                item.productCategory = req.body.productCategory;


                item.save(function (err) {
                    if (err) {
                        res.send(err);
                    }
                    res.status(200);
                    res.json({code: "200", message: 'Product successfully added to catalogue!!'});
                });
            }
        });
    }
});

//##########################################################################################//
//                                Find item by barcode                                      //
//##########################################################################################//
app.get('/findItem/:scanContent', function(req, res) {
    var item = new Item();
    item.scanContent = req.scanContent;
    Item.find({scanContent: item.scanContent}, function (err, items){
        if(items.length > 0){
            res.status(200);
            res.json(items);
        }
        else{
            res.status(400);
            res.json({message: 'An item with that barcode data is not registered with Hoarder. Please try again'});
        }
    });
});

//##########################################################################################//
//                                Add Receipt                                               //
//##########################################################################################//
app.post('/receipt/:email', function (req, res) {
    var receipt = new Receipt();
    if (req.body.items.length==0||!req.body.items||!req.email||!req.body.totalCost) {
        res.status(400);
        var error_message = {
            code: '400',
            message: 'Invalid receipt details please try again!!'
        };
        res.send(error_message);
    } else {
        User.find({email: req.email}, function (err, users) {
            if (users.length > 0) {
                receipt.email = req.email;
                receipt.date = moment().format('MM/DD/YYYY');
                receipt.time = moment().format('hh:mm:ss');
                receipt.totalCost = req.body.totalCost;
                receipt.items = req.body.items;

                receipt.save(function (err) {
                    if (err) {
                        res.send(err);
                    }
                    res.status(200);
                    res.json({code: "200", message: 'Receipt successfully generated!!'});
                });
            } else {
                res.status(400);
                res.json({code: '400', message: 'Issue generating receipt please try again!!'});
            }
        });
    }
});


//##########################################################################################//
//                                Get Receipt by email                                      //
//##########################################################################################//
app.get('/findReceipt/:email', function(req, res) {
    var receipt = new Receipt();
    receipt.email = req.email;
    Receipt.find({email: receipt.email}, function (err, receipts){
        if(receipts.length > 0){
            res.status(200);
            res.json(receipts);
        }
        else{
            res.status(400);
            res.json({message: 'No receipts for this user'});
        }
    });
});

//##########################################################################################//
//                                Server Port Config                                        //
//##########################################################################################//
var port = Number(process.env.PORT || 4000);
app.listen(port, function () {
    console.log("Listening on " + port);
});
