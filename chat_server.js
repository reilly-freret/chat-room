// Require the packages we will use:
var http = require("http"),
  socketio = require("socket.io"),
  fs = require("fs");

var googleTranslate = require('google-translate')("AIzaSyA3N8 - TeQO - vRNWusGNGzAebNTiPLUqkEw");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp) {
  // This callback runs when a new connection is made to our HTTP server.

  fs.readFile("client.html", function(err, data) {
    // This callback runs when the client.html file has been read from the filesystem.

    if (err) return resp.writeHead(500);
    resp.writeHead(200);
    resp.end(data);
  });
});
app.listen(3456);

// Do the Socket.IO magic:
var userDict = [];
var roomDict = [];
var io = socketio.listen(app);
io.sockets.on("connection", function(socket) {
  // This callback runs when a new Socket.IO connection is established.

  socket.on('message_to_server', function(data) {
    var targetRoom = data["target"];
    io.sockets.emit("message_to_client", {
      target: targetRoom,
      message: data["message"],
      uname: data["uname"]
    }) // broadcast the message to other users
  });

  socket.on("translate", function(data) {
    var target1 = data["target"];
    var message1 = data["message"];
    var userName1 = data["uname"];
    var language1 = data["language"];
    googleTranslate.translate(message1, language1, function(err, translation) {
      var trans = translation.translatedText;
      io.sockets.emit("message_to_client", {
        target: target1,
        message: trans,
        uname: userName1
      });
    });
  });

  socket.on('new_user', function(data) { // when a new user joins the site...
    userDict.push({
      user: data["user"],
      userId: data["id"]
    });
    io.sockets.emit("new_user", {
      user: data["user"],
      id: data["id"]
    });
  });

  socket.on('new_room', function(data) {
    var roomHash = makeid();
    var roomyName = data["roomName"];

    roomDict.push({
      name: data["roomName"],
      hash: roomHash,
      pwd: data["password"],
      users: [{
        userName: data["name"],
        userId: data["id"]
      }],
      bannedUsers: []
    });
    socket.emit("validateRoom", {
      roomName: roomyName,
      hashedRoom: roomHash
    });
    pushRooms();
  });

  socket.on('room_request', function(data) {
    var currRooms = [];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].name);
    }
    var userId = data["id"];
    var userName = data["name"];
    var roomyName = data["roomName"];
    var roomIndex = currRooms.indexOf(data["roomName"]);
    var localFlag = false;
    if (roomIndex >= 0) {
      var hashy = roomDict[roomIndex].hash;
    } else {
      socket.emit("errorMessage", {
        errMsg: "Room DNE"
      });
      return;
    }
    if ((data["password"]) == (roomDict[roomIndex]).pwd) {
      if ((roomDict[roomIndex].bannedUsers).indexOf(userName) < 0) {
        socket.emit("validateRoom", {
          roomName: roomyName,
          hashedRoom: hashy
        });
        var usersAlreadyHere = [];
        for (var i = 0; i < (roomDict[roomIndex].users).length; i++) {
          if ((roomDict[roomIndex].users[i]).userId == userId) {
            localFlag = true;
            break;
          }
        }
        if (!localFlag) {
          roomDict[roomIndex].users = (roomDict[roomIndex].users).concat({
            userName,
            userId
          });
        }
      } else {
        socket.emit("errorMessage", {
          errMsg: "U got banned u n00b"
        })
      }
    } else {
      socket.emit("errorMessage", {
        errMsg: "Incorrect password!"
      })
    }
  })

  socket.on("new_visitor", function(data) {
    pushRooms();
  })

  function pushRooms() {
    var currRooms = [];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].name);
    }
    io.sockets.emit("room_list", {
      rooms: currRooms
    });
  }

  function pushUsersInRoom(room) {
    var usersInRoom = [];
    var currRooms = [];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].hash);
    }
    var roomIndex = currRooms.indexOf(room);
    if (roomIndex >= 0) {
      for (var i = 0; i < (roomDict[roomIndex].users).length; i++) {
        usersInRoom = usersInRoom.concat((roomDict[roomIndex].users[i]).userName);
      }
      var roomId = roomDict[roomIndex].hash;
      io.sockets.emit("users_in_room", {
        roomLoc: roomId,
        usersHere: usersInRoom
      });
    } else {
      socket.emit("errorMessage", {
        errMsg: "Something went wrong here. Contact your SysAdmin for more information. (ERR696969)"
      })
    }
  }

  socket.on("thisTest", function(data) {
    var runningOutOfNames = data["roomName"];
    pushUsersInRoom(runningOutOfNames);
  });

  socket.on("user_left", function(data) {
    var usersInRoom = [];
    var userIdsInRoom = [];
    var currRooms = [];
    var room = data["room"];
    var uID = data["id"];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].hash);
    }
    var roomIndex = currRooms.indexOf(room);
    if (roomIndex >= 0) {
      for (var i = 0; i < (roomDict[roomIndex].users).length; i++) {
        userIdsInRoom = userIdsInRoom.concat((roomDict[roomIndex].users[i]).userId);
      }
      var userIndex = userIdsInRoom.indexOf(uID);
      if (userIndex >= 0) {
        (roomDict[roomIndex].users).splice(userIndex, 1);
        for (var i = 0; i < (roomDict[roomIndex].users).length; i++) {
          usersInRoom = usersInRoom.concat((roomDict[roomIndex].users[i]).userName);
        }
        io.sockets.emit("users_in_room", {
          roomLoc: room,
          usersHere: usersInRoom
        });
      }
    }
  });

  socket.on("perma_ban", function(data) {
    var currRooms = [];
    var roomId = data["roomId"];
    var adminId = data["adminId"];
    var banName = data["banName"];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].hash);
    }
    var roomIndex = currRooms.indexOf(roomId);
    if (roomIndex >= 0) {
      if ((roomDict[roomIndex].users[0]).userId == adminId) {
        if ((roomDict[roomIndex].users[0]).userName == banName) {
          socket.emit("errorMessage", {
            errMsg: "You can't ban yourself, cmon"
          });
        } else {
          io.sockets.emit("u_got_banned", {
            roomId: roomId,
            banned: banName
          });
          (roomDict[roomIndex].bannedUsers).push(banName);
        }
      } else {
        socket.emit("errorMessage", {
          errMsg: "Nice try, but you don't own this chat"
        });
      }
    }
  });

  socket.on("temp_ban", function(data) {
    var currRooms = [];
    var roomId = data["roomId"];
    var adminId = data["adminId"];
    var banName = data["banName"];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].hash);
    }
    var roomIndex = currRooms.indexOf(roomId);
    if (roomIndex >= 0) {
      if ((roomDict[roomIndex].users[0]).userId == adminId) {
        if ((roomDict[roomIndex].users[0]).userName == banName) {
          socket.emit("errorMessage", {
            errMsg: "You can't kick yourself, cmon"
          });
        } else {
          io.sockets.emit("u_got_banned", {
            roomId: roomId,
            banned: banName
          });
        }
      } else {
        socket.emit("errorMessage", {
          errMsg: "Nice try, but you don't own this chat"
        });
      }
    }
  })


  ///////////////////////

  socket.on("dm_test", function(data) {
    var currRooms = [];
    var currUsers = [];
    var recipient = data["recipient"];
    var messageContents = data["msg"];
    var senderId = data["mySocketId"];
    var senderName = data["myName"];
    var roomConfirm = data["room"];
    for (var i = 0; i < roomDict.length; i++) {
      currRooms = currRooms.concat(roomDict[i].hash);
    }
    var roomIndex = currRooms.indexOf(roomConfirm);
    if (roomIndex >= 0) {
      for (var i = 0; i < (roomDict[roomIndex].users).length; i++) {
        currUsers.push((roomDict[roomIndex].users[i]).userName);
      }
      var userIndex = currUsers.indexOf(recipient);
      if (userIndex >= 0) {
        var recipientId = (roomDict[roomIndex].users[userIndex]).userId;
        if (senderId == recipientId) {
          socket.emit("errorMessage", {
            errMsg: "Can't slide in to your own DMs, you loser"
          });
        } else {
          io.sockets.to(recipientId).emit("dm", {
            message: messageContents,
            sender: senderName
          });
        }
      }
    }

  })

});





// Random string generator courtesy of user csharptest.net at https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 30; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}









// this comment is important
