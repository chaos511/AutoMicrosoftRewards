console.log("AutoMicrosoftRewards Version: 0.1.5")
const fs = require("fs");
if (!fs.existsSync("./config/default.json")) {
  if (!fs.existsSync("config")) {
    fs.mkdirSync("config");
  }
  console.log("No config file found creating");
  defaultConfig = {
    browserExecutablePath: "C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
    useHeadless: false,
    randomDelay: 5000,
    searchDelay: 5000,
    searchPageDelay: 20000,
    activityDelay: 5000,
    accountDelay: 60000,
    updateCookies: true,
    maxPcSearches: 35,
    maxMobileSearches: 45,
    doDailySet: true,
    stopOnMaxEarned: true,
    pcUserAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363",
    mobileUserAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/54.0.2840.66 Mobile/16A366 Safari/602.1",
    accounts: ["fake_account@fakedomain.com"],
    passwords: ["password123"],
    proxys: [],
  };
  fs.writeFileSync(
    "./config/default.json",
    JSON.stringify(defaultConfig, null, 2)
  );
  console.log("config file generated: Exiting");
  process.exit(0);
}
const puppeteer = require("puppeteer");
const config = require("config");
// const pathToMicrosoftRewards= require('path').join(__dirname, 'microsoftRewards/1.5_0');
require("./helper.js")(config, fs);

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

var searches = [];

async function doSearches(browser, deviceType, account, password, proxy) {
  var pages = await browser.pages();
  var mainPage = pages[0];
  var microsoftPage = await openMicrosoftPage(browser, account, password);
  if (deviceType == 0) {
    await mainPage.setUserAgent(config.get("pcUserAgent"));
  } else {
    await mainPage.setUserAgent(config.get("mobileUserAgent"));
  }
  await mainPage.bringToFront()
  try {
    await loadCookies("bing", account, mainPage, true);
  } catch (e) {}
  try {
    await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", {
      waitUntil: "load",
      timeout: 0,
    });
  } catch (e) {
    console.log("Error Loading Page: " + e);
  }
  if (deviceType == 0) {
    await mainPage.waitForSelector("#id_l");
    await sleep(10000);
    console.log("login");
    try{
      await bingLogin(mainPage, account, password,"bing");
    }catch(e){console.log("login timeout")}
    console.log("done login");
    if (config.get("updateCookies")) {
      try {
        await mainPage.goto(
          "https://www.bing.com/?setmkt=en-us&setlang=en-us",
          { waitUntil: "load", timeout: 0 }
        );
        await saveCookies("bing", account, mainPage);
      } catch (e) {
        console.log("Error updating Cookies: " + e);
        return;
      }
    }
  }
  await saveScreenshot(account.split("@")[0],"bingHome"+(deviceType==0?"Pc":"Mobile"),mainPage)

  console.log("done logging in");
  var maxSearches = 0;
  if (deviceType == 0) {
    maxSearches = config.get("maxPcSearches");
  } else {
    maxSearches = config.get("maxMobileSearches");
  }
  var startingSearchNum = Math.max(
    parseInt(Math.random() * (searches.length - maxSearches)),
    0
  );
  var userInfo;
  await sleep(5000);
  for (var x = 0; x < maxSearches; x++) {
    if (x >= searches.length) {
      console.log("search list to short: stopping");
      break;
    }
    userInfo = await getUserInfo(microsoftPage);
    var sleepTime =
      Math.random() * config.get("randomDelay") + config.get("searchPageDelay");
    var earnerToday = "failed to get daily earnings";
    try {
      if (deviceType == 0) {
        earnerToday =
          userInfo.dashboard.userStatus.counters.pcSearch[0].pointProgress +
          "/" +
          userInfo.dashboard.userStatus.counters.pcSearch[0].pointProgressMax;
        if (
          config.get("stopOnMaxEarned") &&
          userInfo.dashboard.userStatus.counters.pcSearch[0].pointProgress ==
            userInfo.dashboard.userStatus.counters.pcSearch[0].pointProgressMax
        ) {
          console.log("Earned Today: " + earnerToday);
          break;
        }
      }
      if (deviceType == 1) {
        earnerToday =
          userInfo.dashboard.userStatus.counters.mobileSearch[0].pointProgress +
          "/" +
          userInfo.dashboard.userStatus.counters.mobileSearch[0]
            .pointProgressMax;
        if (
          config.get("stopOnMaxEarned") &&
          userInfo.dashboard.userStatus.counters.mobileSearch[0]
            .pointProgress ==
            userInfo.dashboard.userStatus.counters.mobileSearch[0]
              .pointProgressMax
        ) {
          console.log("Earned Today: " + earnerToday);
          break;
        }
      }
    } catch (e) {
      console.log("Error: " + e);
    }
    await search(searches[startingSearchNum + x], mainPage);
    console.log(
      "Waiting " +
        parseInt(sleepTime / 1000) +
        " Seconds for next search, todays earnings: " +
        earnerToday
    );
    await sleep(sleepTime);
  }
  if (config.get("updateCookies")) {
    try {
      await mainPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", {
        waitUntil: "load",
        timeout: 0,
      });
      await saveCookies("bing", account, mainPage);
    } catch (e) {
      console.log("Error updating Cookies: " + e);
      return;
    }
  }
  if (!userInfo) {
    userInfo = await getUserInfo(microsoftPage);
  }
  await microsoftPage.close();
  return userInfo;
}
async function openMicrosoftPage(inBrowser, inAccount, password) {
  var page = await inBrowser.newPage();
  await page.setUserAgent(config.get("pcUserAgent"));
  await loadCookies("microsoft", inAccount, page, true);
  await loadCookies("bing", inAccount, page, true);
  try {
    await page.goto(
      "https://account.microsoft.com/rewards?setmkt=en-us&setlang=en-us",
      { waitUntil: "load", timeout: 0 }
    );
  } catch (e) {
    console.log("Error Loading Page: " + e);
  }
  await sleep(5000);
  await saveScreenshot(inAccount.split("@")[0],"microsoftLogin",page)
  
  console.log("login");
  try{
  await bingLogin(page, inAccount, password,"ms");
}catch(e){console.log("login timeout")}
  console.log("done login");
  await sleep(5000);
  try {
    if (!page.url().includes("https://account.microsoft.com")) {
      await page.goto(
        "https://account.microsoft.com/rewards?setmkt=en-us&setlang=en-us",
        { waitUntil: "load", timeout: 0 }
      );
    }
    await this.saveScreenshot(inAccount.split("@")[0],"rewardsPage",page)

  } catch (e) {
    console.log("Error Loading Page: " + e);
  }
  await saveCookies("microsoft", inAccount, page);
  return page;
}
async function getUserInfo(page) {
  return await eval(`
    page.evaluate(function(){
      let xhr = new XMLHttpRequest();
      xhr.open("GET","https://rewards.microsoft.com/rewards/api/getuserinfo?type=1&X-Requested-With=XMLHttpRequest",false)
      xhr.send()
      try{
        console.log(JSON.parse(xhr.response))
        return JSON.parse(xhr.response)
      }catch{
        return null
      }
    })
  `);
}

async function doDailySet(browser, account, password, proxy) {
  var pages = await browser.pages();
  var microsoftPage = await openMicrosoftPage(browser, account, password);


  await pages[0].close();

  await saveScreenshot(account.split("@")[0],"dailySetHome",microsoftPage)

  var userInfo = await getUserInfo(microsoftPage);
  var date = new Date();
  var month =
    date.getMonth() + 1 < 10
      ? "0" + (date.getMonth() + 1)
      : date.getMonth() + 1;
  var day = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
  dayString = month + "/" + day + "/" + date.getFullYear();
  // var count=0
  for (var set in userInfo.dashboard.dailySetPromotions[dayString]) {
    try {
      if (userInfo.dashboard.dailySetPromotions[dayString][set].complete) {
        console.log("daily set " + set + " done");
      } else {
        if(userInfo.dashboard.dailySetPromotions[dayString][set].attributes.type=="urlreward"){
          console.log("Found URL Reward")
          await clickDailySet(microsoftPage,set)
          await sleep(config.get("activityDelay"));
        }else if(userInfo.dashboard.dailySetPromotions[dayString][set].attributes.type=="quiz"){
        var activityPage = await browser.newPage();
        await activityPage.goto(
          userInfo.dashboard.dailySetPromotions[dayString][set].destinationUrl,
          { waitUntil: ["networkidle0", "domcontentloaded"] }
        );
        await sleep(config.get("activityDelay"));
        console.log("starting activity");

        await saveScreenshot(account.split("@")[0],"activityLoaded"+set,activityPage)
        await doQuiz(activityPage,set,account)
      }else{
        console.log("Unknowen attr type: "+userInfo.dashboard.dailySetPromotions[dayString][set].attributes.type)
        console.log(userInfo.dashboard.dailySetPromotions[dayString][set])
      }
      }
    } catch (e) {
      await saveScreenshot(account.split("@")[0],"activityError"+set,activityPage)

      console.log("daily set " + set + " failed: " + e);
    }
    try{
      await sleep(5000)
      await activityPage.close();
    }catch(ignore){}
  }
  await sleep(5000)
}
async function doQuiz(activityPage,set,account){
  console.log(
    await eval(`
    activityPage.evaluate(async function(){
        if(document.querySelector(".TriviaOverlayData")){//lower third
          if(document.querySelector("#rqStartQuiz")){//quiz
            document.querySelector("#rqStartQuiz").click()
            return "quiz started"
          }
        }
      })
    `)
  );
  await sleep(config.get("activityDelay"));
  await saveScreenshot(account.split("@")[0],"activityStarted"+set,activityPage)
  var activityType = await eval(`
    activityPage.evaluate(async function(){
        if(document.querySelector(".btQueTtle")&&document.querySelector(".btQueTtle").innerText=="This or that?"){//this or that
          return 1//this or that
        }else if(document.querySelector(".rqTitle")&&document.querySelector(".rqTitle").innerText=="Rewards quiz"){
          return 2//supersonic
        }else if(document.querySelector(".bt_title")&&document.querySelector(".bt_title").innerText=="Today's Rewards poll"){
          return 3//poll
        }else if(document.querySelector(".b_focusLabel")&&document.querySelector(".b_focusLabel").innerText.includes("quiz")){
          return 4//homepage quiz
        }else{
          return 0
        }
      })
    `);
  console.log("Activity Type: " + activityType);

  switch (activityType) {
    case 1:
      for (var question = 0; question < 7; question++) {
        await eval(`
          activityPage.evaluate(async function(){
              var options=document.getElementsByClassName("btOptionCard")
              options[parseInt(Math.random()*1.9)].click()
            })
          `);
        await sleep(5000);
      }
      break;
    case 2:
      for (var question = 0; question < 20; question++) {
        if (question % 3 == 0) {
          try {
            await activityPage.click("#rqAnswerOption0");
          } catch (ignore) {}
        }
        await eval(`
          activityPage.evaluate(async function(){
              if(document.querySelector(".btOptions")){
                for(var option of document.querySelector(".btOptions").children){
                  if(option.children[0].getAttribute("iscorrectoption")=="True"){
                    option.children[0].click()
                  }
                }
                return "Subtype 1"
              }else{
                for(var option of document.getElementsByClassName("rq_button")){
                  option.querySelector("input").click()
                }
                return "Subtype 2"
              }
            })
          `);
        await sleep(3000);
      }
      break;
    case 3:
      await eval(`
          activityPage.evaluate(async function(){
            btoption0.click()
          })
        `);
      await sleep(3000);
      break;
    case 4:
      for (var question = 0; question < 15; question++) {
        try {
          await eval(`
            activityPage.evaluate(async function(){
                if(document.getElementsByClassName("b_vPanel").length>0){
                  try{
                    document.getElementsByClassName("b_vPanel")[document.getElementsByClassName("b_vPanel").length-1].querySelector(".wk_paddingBtm").onmouseup()
                  }catch(ignore){}
                  try{
                    document.getElementsByClassName("b_vPanel")[0].querySelector(".wk_paddingBtm").onmouseup()
                  }catch(ignore){}
                }
              })
            `);
          await sleep(500);
          await eval(`
              activityPage.evaluate(async function(){
                WKQuiz_V2.showQuestionPane()             
              })
            `);
          await sleep(500);
        } catch (ignore) {}
      }
      break;
    default:
      console.log("unknown quiz type");
      await sleep(config.get("activityDelay"))
      break;
  }
}
async function run(account, password, proxy) {
  try {
    var args = ["--start-maximized"];
    if (config.get("useHeadless")) {
      args.push("--headless");
    }
    if (proxy) {
      args.push("--proxy-server=" + proxy);
    }
    var browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: args,
      executablePath: config.get("browserExecutablePath"),
    });
  } catch (e) {
    console.log("Browser Failed To Start: " + e);
    return;
  }
  var userInfo=await doSearches(browser,0,account,password,proxy)
  console.log("PC Searches Done")
  if(userInfo.dashboard.userStatus.levelInfo.activeLevel=="Level2"){
    console.log("Starting Mobile")
    await doSearches(browser,1,account,password,proxy)
    console.log("Mobile Searches Done")
  }else{
    console.log("Mobile Not Available")
  }
  if (config.get("doDailySet")) {
    console.log("Starting Daily Set");
    await doDailySet(browser, account, password, proxy);
  }
  console.log("Account " + account + " Done, Closing Browser");
  browser.close();
}
var accountNum = 0;
async function main() {
  searches = await updateTrendingWords();
  var args=process.argv
  for(var arg in args){
    if(args[arg]=="--account"||args[arg]=="-a"){
      console.log(args)
      if(args.length>arg&&parseInt(args[parseInt(arg)+1])>0&&parseInt(args[parseInt(arg)+1])-1<=config.get("accounts").length){
        accountNum=parseInt(args[parseInt(arg)+1])-1
      }else{
        console.error("Invalid Account Specified with -a flag")
        process.exit(1);
      }
    }
  }

  await run(
    config.get("accounts")[accountNum],
    config.get("passwords")[accountNum],
    config.get("proxys")[accountNum]
  );
  accountNum++;
  if (accountNum >= config.get("accounts").length||process.argv.join(" ").includes("-a")) {
    console.log("All Accounts Done: Exiting");
    process.exit(0);
  }
  console.log(
    "waiting " + config.get("accountDelay") / 1000 + " seconds for next account"
  );
  setTimeout(main, config.get("accountDelay"));
}
main();
