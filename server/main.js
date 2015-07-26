var T, me = null;
var progress = {value: 0, max: 100, hide: true};

Meteor.startup(function () {
  T = InitTwitter();

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

ProgressHandler = function(i, max) {
  if (!i) {
    progress.hide = true;
    progress.value = progress.max;
    return;
  } else {
    progress.value = i;
    progress.max = max;
    progress.hide = false;
  }
}
Meteor.methods({
  'getFollowers': function(username) {
    console.log('Received request to get followers for @' + username);
    var cursor = -1;

    // Clear db
    CopyFollowers.remove({});
    var followers_ids = GetFollowersID(T, username);
    console.log('Found ' + followers_ids.length + ' followers');
    this.unblock();
    var followers = HydrateIDs(T, followers_ids, ProgressHandler);

    console.log('Now inserting to db');
    followers.forEach(function(elt, index, array) {
      CopyFollowers.insert(elt);
    });
  },
  'copyFollowers': function(filter) {
    console.log('Received request to copy followers');
    filter.location = new RegExp(filter.location, 'i');
    var toFollow = CopyFollowers.find(filter).fetch();

    console.log('Following ' + toFollow.length + ' people');

    // perform follow, limit to 100 to check
    toFollow.forEach(function(elt, index, array) {
      FollowUser(T, elt.screen_name);
    });
  },
  'getProgress' : function() {
    return progress;
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
      var non_followers = HydrateIDs(T, non_followers_IDs, ProgressHandler);
      
      non_followers.forEach(function(elt, index, array) {
       NonFollowers.insert(elt);
      });

      var fans_IDs = minus(followers, friends); // fans are people that follow current user but not followed back.
      var fans = HydrateIDs(T, fans_IDs, ProgressHandler);
      
      fans.forEach(function(elt, index, array) {
       Fans.insert(elt);
      });

      var following = HydrateIDs(T, friends, ProgressHandler);

      following.forEach(function(elt, index, array) {
       AllFollowings.insert(elt);
      });
    }
  }
});
