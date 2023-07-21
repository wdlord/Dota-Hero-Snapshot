
/* 
For this project I used the OpenDota API to display a snapshot of a given hero
in the Dota 2 meta. It displays the hero's primary attribute, name, picture, and
winrate across non-pro brackets. It also displays the 5 most bought items across
the early, mid, and late game for that hero. Sites like DotaBuff give way to many 
stats for a guy like me, I just want the big picture, and I think this is decent for that.


I needed to access 3 separate API endpoints in order to complete this project.

1. I needed to retrieve lookup tables for heros and items (Constants). 
    Items are often referenced in the API by ID number, but to retrieve their picture
    I have to find the name used in the code in the game first. I have to get the ID to get
    the name, then I have to use the name to get the picture. I cache these tables on page 
    load to avoid having to wait for information that won't change.
    
2. I needed to retrieve stats for all heroes (including winrates).
    In order to get the winrates across all ranked brankets, I cache the hero stats
    list on page load.
    
3. I needed to access a given heroes popular item list.
    I have to retrieve this each time I random or search a hero. I filter this list 
    to avoid useless components that don't really matter for the build. I also have to
    sort by popularity so I have to change the data structure returned by the API.


If I were going to keep coding this project I would go in one of 2 directions.

Direction 1: I would look into adding the 5 top hero counters to the hero and the
top 5 heroes this hero counters.

Direction 2: I would turn it into a game where you have to guess the hero based on
the items. You start with some items hidden and every failed guess reveals more items.
*/

BASE_URL = "https://api.opendota.com/api/";

let HERO_CONSTANTS = null;
let ITEM_CONSTANTS = null;
let ITEM_IDS = null;
let HERO_STATS = null;


// When the page loads we cache any API calls we can to save load time.
// We also select a random hero on page load to populate the DOM.
window.onload = async function() {
    HERO_CONSTANTS = await Constants("heroes");
    ITEM_CONSTANTS = await Constants("items");
    ITEM_IDS = await Constants("item_ids");
    HERO_STATS = await HeroStats();
    
    RandomHero();
};

// RAW API CALLS
// (Direct calls to https://docs.opendota.com/).

async function HeroStats() {
    let response = await fetch(BASE_URL + "heroStats");
    let data = await response.json();
    return data;
}

async function Constants(resource=null) {
    let extension = resource ? `/${resource}` : "";

    let response = await fetch(BASE_URL + "constants" + extension);
    let data = await response.json();
    return data;
}

async function ItemPopularity(heroId) {
    let response = await fetch(BASE_URL + `heroes/${heroId}/itemPopularity`);
    let data = await response.json();
    return data;
}

// SPECIFIC FUNCTIONALITY

// Gets the gets the hero stats object for a hero by name query.
async function GetHero(query) {

    for (let hero of HERO_STATS) {

        // Edge case for Io.
        if (query == 'io' && hero['localized_name'].toLowerCase() != 'io') {
            continue;
        } 

        // Returns the first hero whose name or internal name matches/contains the query.
        if (hero['localized_name'].toLowerCase().includes(query) || hero['name'].slice(14, hero['name'].length).includes(query)) {
            return hero;
        }
    }
    return null;
}

// Gets a list of item constants based on a list of item IDs.
async function GetItems(itemIds) {

    let items = [];

    for (let pair of itemIds) {
        let iid = pair[0]
        let item_name = ITEM_IDS[iid];
        let item_obj = ITEM_CONSTANTS[item_name];
        if (item_obj != undefined) items.push(item_obj);
    }

    return items;
}

// Converts the most bought items into a sortable format (2D array) and sorts it.
function SortItems(periodItems) {
    
     // Create items array.
    var items = Object.keys(periodItems).map(function(key) {
        return [key, periodItems[key]];
    });
    
    // Sort the array based on the second element (total purchases).
    items.sort(function(first, second) {
        return second[1] - first[1];
    });

    return items;
}

// Filters the most bought items for a given stage of the game.
// We filter the items to display the more interesting ones.
async function MostBought(period, stats) {

    let items = SortItems(stats[period]);
    
    let objectList = await GetItems(items);

    let filteredItems = objectList.filter(function(item) {
        if ([1, 41, 609].includes(item['id'])) return true;
        if (item['components']) return true;
        return false;
    });

    // This handles the edge case where there are fewer than 5 items available.
    for (let i = 0; filteredItems.length < 5; i++) {
        filteredItems.push(objectList[i]);
    }
    
    return filteredItems;
}

// Generates the 5 most bought items for a hero in early, mid, and late stages of the game.
async function MostBoughtItems(heroId) {

    let openDotaStats = await ItemPopularity(heroId);
    let earlyGame = await MostBought('early_game_items', openDotaStats);
    let midGame = await MostBought('mid_game_items', openDotaStats);
    let lateGame = await MostBought('late_game_items', openDotaStats);

    return {
        'early_game': earlyGame.slice(0, 5),
        'mid_game': midGame.slice(0, 5),
        'late_game': lateGame.slice(0, 5)
    }
}

// Updates the DOM of a given row with given items.
function UpdateItems(row, items) {
    for (let i = 0; i < 5; i++) {
        row.children[i].src = "https://cdn.dota2.com/" + items[i]['img'];
    }
}

// Generates a random number between a min and max value (both inclusive).
function RandomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

// Gets the winrate of a hero stats object.
function WinRate(hero) {
    let picks = [], wins = [];

    for (let i = 1; i <= 8; i++) {
        picks.push(hero[`${i}_pick`]);
        wins.push(hero[`${i}_win`]);
    }

    let sum_picks = picks.reduce((a, b) => a + b, 0);
    let sum_wins = wins.reduce((a, b) => a + b, 0);

    let winrate = (sum_wins / sum_picks) * 100;

    return winrate.toFixed(2);
}

// Attribute dict.
var attr_dict = {
    'str': 'strength',
    'agi': 'agility',
    'int': 'intelligence',
    'all': 'universal'
}

// BUTTONS

// Actually updates the DOM.
async function UpdatePage(heroName) {
    
    let hero = await GetHero(heroName);

    if (!hero) {
        alert("Could not find that hero.");
        return;
    }
    
    let heroConstant = await HERO_CONSTANTS[hero['id']];

    // Set hero name in DOM.
    document.getElementById("hero-name").innerHTML = hero['localized_name'].toUpperCase();

    // Set hero attribute in DOM.
    let attribute = attr_dict[hero['primary_attr']];
    let attributeDOM = document.getElementById("attribute");
    let attributeImage = `images/${attribute}.png`;
    let attributeName = attribute[0].toUpperCase() + attribute.slice(1);
    attributeDOM.src = attributeImage;
    // attributeDOM.parentElement.innerHTML = `<img id="attribute" src="${attributeImage}">${attributeName}`;
    
    // Update winrate in DOM.
    document.getElementById("winrate").innerHTML = "Winrate: " + WinRate(hero) + "%";

    // Set hero image in DOM.
    document.getElementById("hero-image").src = "https://cdn.dota2.com/" + heroConstant['img'];

    // Get most bought items.
    let items = await MostBoughtItems(hero['id']);

    // Gets the DOM objects for the items.
    let earlyGame = document.getElementById("early-game");
    let midGame = document.getElementById("mid-game");
    let lateGame = document.getElementById("late-game");

    // Updates items in DOM.
    UpdateItems(earlyGame, items['early_game']);
    UpdateItems(midGame, items['mid_game']);
    UpdateItems(lateGame, items['late_game']);
}

// This is called when the Search button is clicked.
async function SearchHero() {
    
    // Get and process input value from search field.
    let heroName = document.getElementById("hero-search").value;
    heroName = heroName.toLowerCase().trim();

    if (heroName == "") RandomHero();
    else UpdatePage(heroName);
}

// This is called when the Random button is clicked.
async function RandomHero() {

    // Selects a hero name at random.
    document.getElementById("hero-search").value = "";
    let targetHero = HERO_STATS[RandomIntFromInterval(0, HERO_STATS.length)]
    let heroName = targetHero['name'].slice(14, targetHero['name'].length);
    
    UpdatePage(heroName);
}
