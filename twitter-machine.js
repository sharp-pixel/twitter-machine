// twitter-machine.js
var CopyFollowers = new Mongo.Collection("copyfollowers");
var NonFollowers = new Mongo.Collection("nonfollowers");
var Fans = new Mongo.Collection("fans");
var AllFollowings = new Mongo.Collection("allfollowings");
var Whitelist = new Mongo.Collection("whitelist");
var Blacklist = new Mongo.Collection("blacklist");

Router.route('/', function() {
  this.redirect('/nonFollowers');
});

Router.route('/nonFollowers');
Router.route('/fans');
Router.route('/copyFollowers');
Router.route('/allFollowings');
Router.route('/blacklist');
Router.route('/whitelist');

if (Meteor.isClient) {
  Meteor.subscribe("copyfollowers");
  Meteor.subscribe("nonfollowers");
  Meteor.subscribe("fans");
  Meteor.subscribe("allfollowings");
  Meteor.subscribe("blacklist");
  Meteor.subscribe("whitelist");

  Meteor.startup(function() {
    Session.setDefault('locationFilter', '');

    Meteor.call('init'); // populate non-followers collection on client startup
  });

  // This code only runs on the client
  Template.CopyFollowers.helpers({
    followers: function () {
      var filter = {};
      if (Session.get("hideFollowing")) {
        filter.following = {$ne: true};
      }
      
      var location_filter = Session.get("locationFilter");

      if (location_filter.length > 0) {
        var regexp = build_regexp(location_filter);
        filter.location = regexp;
      }

      return CopyFollowers.find(filter, {sort: {createdAt: -1}});
    },
    hideFollowing: function() {
      return Session.get("hideFollowing");
    }
  });

  Template.CopyFollowers.events({
    "submit .search-followers": function (event) {
      // This function is called when the new task form is submitted
      var username = event.target.username.value;

      // Call server method to do the work
      Meteor.call('getFollowers', username);

      // Prevent default form submit
      return false;
    },
    "change .hide-following input": function (event) {
      Session.set("hideFollowing", event.target.checked);
    },
    "keyup .location, paste .location": function(event) {
      //console.log(event.target.value);
      Session.set('locationFilter', event.target.value);
    }
  });

  Template.user.events({
    "click paste .follow": function () {
      console.log('Request follow');
    }
  });

  Template.NonFollowers.helpers({
    nonfollowers: function() {
      return NonFollowers.find({});
    }
  });

  Template.Fans.helpers({
    fans: function() {
      return Fans.find({});
    }
  });

  Template.AllFollowings.helpers({
    allfollowings: function() {
      return AllFollowings.find({});
    }
  });

  Template.Blacklist.helpers({
    blacklist: function() {
      return Blacklist.find({});
    }
  });

  Template.Whitelist.helpers({
    blacklist: function() {
      return Whitelist.find({});
    }
  });
}

if (Meteor.isServer) {
  var T, me = null, Future, Promise;

  Meteor.startup(function () {
    var Twit = Meteor.npmRequire('twit');
    Future = Npm.require('fibers/future');

    var twitter_secret_string = Assets.getText('twitter-secret.json');
    var twitter_secret = JSON.parse(twitter_secret_string);

    T = new Twit(twitter_secret);

    T.get('account/settings', {}, function(err, data, response) {
      if (data != null) {
        me = data;
      }
      else {
        console.log('Request limit reached for command "GET account/settings');
        me = null;
      }
    });
  });

  Meteor.publish("copyfollowers", function() {
    return CopyFollowers.find();
  });

  Meteor.publish("nonfollowers", function() {
    return NonFollowers.find();
  });

  Meteor.publish("fans", function() {
    return Fans.find();
  });

  Meteor.publish("allfollowings", function() {
    return AllFollowings.find();
  });

  Meteor.publish("blacklist", function() {
    return Blacklist.find();
  });

  Meteor.publish("whitelist", function() {
    return Whitelist.find();
  });

  Meteor.methods({
    'getFollowers': function(username) {
      console.log('Received request to get followers for @' + username);
      var cursor = -1;

      // Clear db
      CopyFollowers.remove({});

      var followers_ids = GetFollowersID(T, username);
      var followers = HydrateIDs(T, followers_ids);

      followers.forEach(function(elt, index, array) {
        CopyFollowers.insert(elt);
      });
    },
    'copyFollowers': function() {
      console.log('Received request to copy followers');
    },
    'init': function() {
      console.log('Initialize current user collections');

      // Clear db
      NonFollowers.remove({});
      Fans.remove({});
      AllFollowings.remove({});

      if (me !== null && me.screen_name !== '') {
        var username = me.screen_name;

        var followers = GetFollowersID(T, username);
        var friends = GetFriendsID(T, username);
        var non_followers_IDs = minus(friends, followers); // non-followers are people followed by current user but not following him back.
        var non_followers = HydrateIDs(T, non_followers_IDs);
        
        non_followers.forEach(function(elt, index, array) {
         NonFollowers.insert(elt);
        });

        var fans_IDs = minus(followers, friends); // fans are people that follow current user but not followed back.
        var fans = HydrateIDs(T, fans_IDs);
        
        fans.forEach(function(elt, index, array) {
         Fans.insert(elt);
        });

        var following = HydrateIDs(T, friends);

        following.forEach(function(elt, index, array) {
         AllFollowings.insert(elt);
        });
      }
    }
  });
}

function GetFollowersID(T, username) {
  cursor = -1;
  var followers = [];

  // Get followers
  do {
    var future = new Future();

    T.get('followers/ids',
      {
        screen_name: username,
        count: 5000,
        cursor: cursor
      },
      function(err, data, response) {
        if (data != null) {        
          data.ids.forEach(function(id) {
            followers.push(id);
          });

          future['return']({
            cursor: data.next_cursor
          }); // Set future value
        }
        else {
          // Limit reached, dispatch on another process ?
          console.log('Request limit reached for command "GET followers/ids"');
          future['return']({
            data: [],
            cursor: 0
          });
        }
      }
    );

    var res = future.wait(); // serialize at this point

    cursor = res.cursor;
  } while (cursor != 0);
  
  return followers;
}

function GetFriendsID(T, username) {
  var cursor = -1;
  var friends = [];

  // Get friends
  do {
    var future = new Future();

    T.get('friends/ids',
      {
        screen_name: username,
        count: 5000, // 5000 is the biggest chunk size allowed by Twitter.
        cursor: cursor
      },
      function(err, data, response) {
        if (data != null) {        
          data.ids.forEach(function(id) {
            friends.push(id);
          });

          future['return']({
            cursor: data.next_cursor
          }); // Set future value
        }
        else {
          // Limit reached, dispatch on another process ?
          console.log('Request limit reached for command "GET friends/ids"');
          future['return']({
            data: [],
            cursor: 0
          });
        }
      }
    );

    var res = future.wait(); // 

    cursor = res.cursor;
  } while (cursor != 0);

  return friends;
}

// Get Twitter user objects from IDs
function HydrateIDs(T, array) {
  var result = [];

  if (array == null) {
    console.log('null array');

    return result;
  }

  // Perform hydration in chunks of 100 people at a time.
  // 100 is the max chunk size allowed by Twitter.
  for (var i = 0; i < array.length; i += 100) {
    var future = new Future();
    var temp = array.slice(i, i + 100).join();

    T.get('users/lookup',
      {
        user_id: temp,
        include_entities: true
      },
      function(err, data, response) {
        if (data != null) {
          future['return'](data);
        }
        else {
          console.log('Request limit reached for command "GET users/lookup"');
        }
      }
    );

    var res = future.wait();

    result = result.concat(res);
  }

  return result;
}

// Returns elements of A ∩ B
function intersection(A, B) {
  var C = [];

  for (var i = 0; i < A.length; ++i) {
    for (var j = 0; j < B.length; ++j) {
      if (A[i] == B[j]) {
        C.push(A[i]);
        break;
      }
    }
  }

  return C;
}

// Returns elements of A \ B
function minus(A, B) {
  var C = [];

  for (var i = 0; i < A.length; ++i) {
    var found = false;
    for (var j = 0; j < B.length; ++j) {
      if (A[i] == B[j]) {
        found = true;
        break;
      }
    }
    if (!found) {
      C.push(A[i]);
    }
  }

  return C;
}

function build_regexp(str) {
  // Split comma-separated input string
  //
  str = str.replace(/ /g,''); // remove white spaces from input string
  var array = str.split(','); // split comma-separated input string

  // Build regexp for lazy search
  var regexp = '';
  var filler = '(\\w|\\s)*'
  var first_word = true;

  array.forEach(function(elt) {
    var first_char = true;
    if (!first_word) {
      regexp += '|';
    }

    regexp += '(';
    for (var i = 0; i < elt.length; ++i) {
      if (!first_char) {
        regexp += filler;
      }

      regexp += elt.charAt(i);

      first_char = false;
    }

    regexp += ')';

    first_word = false;
  });

  return new RegExp(regexp, 'i');
}
