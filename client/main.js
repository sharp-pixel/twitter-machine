Meteor.subscribe("copyfollowers");
Meteor.subscribe("nonfollowers");
Meteor.subscribe("fans");
Meteor.subscribe("allfollowings");
Meteor.subscribe("blacklist");
Meteor.subscribe("whitelist");

Meteor.startup(function() {
  Session.setDefault('locationFilter', '');

  Meteor.call('init'); // populate non-followers collection on client startup
  //todo move to ReactiveVar
  Session.setDefault('progress', {value: 0, max: 100, hide: true});
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
      filter.location = new RegExp(regexp, 'i');
    }

    return CopyFollowers.find(filter, {sort: {createdAt: -1}});
  },
  hideFollowing: function() {
    return Session.get("hideFollowing");
  }
});
function progressTick () {
  Meteor.call('getProgress', function (error, result) {
    Session.set("progress", result);
    if (result.value == result.max)
      Meteor.clearTimeout(tick);
  });
}

Template.progress.helpers({
  progress : function() {
    return Session.get('progress');
  }
});

Template.CopyFollowers.events({
  "submit .search-followers": function (event) {
    // This function is called when the new task form is submitted
    var username = event.target.username.value;

    var tick = Meteor.setInterval(progressTick, 1000);
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
  },
  "click .btn-copy": function(event) {
    var filter = {
      following: {$ne: true} // do not try to folloz already followed people.
    };
    
    var location_filter = Session.get("locationFilter");

    console.log('Filter: ' + location_filter);

    if (location_filter.length > 0) {
      var regexp = build_regexp(location_filter);
      filter.location = regexp;
    }

    console.log(filter);

    Meteor.call('copyFollowers', filter);
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