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
      console.log('Found ' + followers_ids.length + ' followers');
      var followers = HydrateIDs(T, followers_ids);

      console.log('Now inserting to db');
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
