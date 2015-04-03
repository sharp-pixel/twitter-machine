// simple-todos.js
Followers = new Mongo.Collection("followers");

if (Meteor.isClient) {
  Meteor.subscribe("followers");

  // This code only runs on the client
  Template.body.helpers({
    followers: function () {
      if (Session.get("hideFollowing")) {
        // If hide completed is checked, filter tasks
        return Followers.find({following: {$ne: true}}, {sort: {createdAt: -1}});
      } else {
        // Otherwise, return all of the tasks
        return Followers.find({}, {sort: {createdAt: -1}});
      }
    },
    hideFollowing: function() {
      return Session.get("hideFollowing");
    }
  });

  Template.body.events({
    "submit .search-followers": function (event) {
      // This function is called when the new task form is submitted

      var username = event.target.text.value;

      //Followers.remove({}); // clear result

      // Call server method to do the work
      Meteor.call('getFollowers', username);

      // Prevent default form submit
      return false;
    },
    "change .hide-following input": function (event) {
      Session.set("hideFollowing", event.target.checked);
    }
  });

  Template.follower.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      //Followers.update(this._id, {$set: {checked: !this.checked}});
    },
    "click .follow": function () {
      //Followers.remove(this._id);
      console.log('Request follow');
    }
  });
}

if (Meteor.isServer) {
  var T, me = '', Future;

  Meteor.startup(function () {
    var Twit = Meteor.npmRequire('twit');
    Future = Npm.require('fibers/future');

    var twitter_secret_string = Assets.getText('twitter-secret.json');
    var twitter_secret = JSON.parse(twitter_secret_string);

    T = new Twit(twitter_secret);

    T.get('account/settings', {}, function(err, data, response) {
      me = data.screen_name;
    });
  });

  Meteor.publish("followers", function () {
    return Followers.find();
  });

  Meteor.methods({
    'getFollowers' : function(username) {
      console.log('Received request to get followers for @' + username);
      var cursor = -1;
      var it = 0;

      do {
        var future = new Future();
        var followers = [];

        T.get('followers/list',
          {
            screen_name: username,
            count: 200,
            cursor: cursor
          },
          function(err, data, response) {
            if (data != null) {
              data.users.forEach(function(user) {
                followers.push(user);
                // cannot insert element to collection at this point because we are not within a Fiber
              });

              future['return']({
                data: followers,
                cursor: data.next_cursor
              }); // Set future value
            }
            else {
              // Limit reached, dispatch on another process ?
              console.log('Request limit reached for command "GET followers/list"');
              future['return']({
                data: [],
                cursor: 0
              });
            }
          }
        );

        var res = future.wait(); // 

        cursor = res.cursor;

        res.data.forEach(function(elt, index, array) {
          Followers.insert(elt);
        });

        console.log('it: ' + it);
        ++it;
      } while (cursor != 0);
    }
  });
}
