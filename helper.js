module.exports = function(config,fs) { 
    const fetch = require("node-fetch");
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ attrkey: "ATTR" });

    this.bingLogin=async function(inPage,username,password){
        var loginText=
            await eval(`
                inPage.evaluate(function(){
                    if(document.querySelector("#id_s")){
                        loginText=document.querySelector("#id_s").innerText
                        if(loginText=="Sign in"&&document.querySelector("#id_s").getAttribute("aria-hidden")=="false"){
                            return 1
                        }
                    }
                    if(document.querySelector(".mectrl_headertext.mectrl_truncate")){
                        loginText=document.querySelector(".mectrl_headertext.mectrl_truncate").innerText
                        if(loginText=="Sign in"){
                            return 2
                        }
                    }
                    if(document.location.href.includes("login.live")){
                        return 3
                    }
                    return 0
                    })
            `)
        console.log("login: "+loginText)
        if(loginText>0){
            if(loginText<3){
                await inPage.click(loginText==1?'#id_l':'.mectrl_headertext.mectrl_truncate');
            }
            await inPage.waitForSelector("#i0116")
            await sleep(1000)
            await inPage.type("#i0116",username+'\n')
            await inPage.waitForSelector("#i0118")
            await sleep(1000)
            await inPage.type("#i0118",password+'\n')
            await sleep(3000)
            await eval(`
                inPage.evaluate(function(){
                    if(document.querySelector(".row.text-title")&&document.querySelector(".row.text-title").innerText=="Stay signed in?"){
                        idSIButton9.click()
                    }
                })
            `)
            await sleep(1000)
        }
    }
    this.clickDailySet=async function(inPage,num){
          return await eval(`  
            inPage.evaluate(function(num){
                if(!document.querySelector(".m-card-group")){
                    return "error"
                }
                var set=document.querySelector(".m-card-group").getElementsByTagName("mee-card")
                if(set.length<3){
                    return "error"
                }
                if(set[num].getElementsByClassName("mee-icon mee-icon-AddMedium").length>0||set[num].getElementsByClassName("mee-icon mee-icon-HourGlass x-hidden-focus").length>0){
                    set[num].getElementsByTagName('a')[1].click()
                }else{
                    return "done"
                }
            },num)
          `)
    }
    this.getBalance=async function (inBrowser,account){
        page=await inBrowser.newPage()
        await page.setUserAgent(config.get("pcUserAgent"))
        await loadCookies("bing",account,page,false)
        await page.goto("https://www.bing.com/rewardsapp/bepflyoutpage?style=modular", { waitUntil: 'load', timeout: 0 });
        var bal= await eval(`
            page.evaluate(function(){
                var bal={}
                if(document.querySelector(".allsearch")){
                    bal['earnedPcSearch']=document.querySelector(".allsearch").innerText
                }else if(document.querySelector(".pcsearch")){
                    bal['earnedPcSearch']=document.querySelector(".pcsearch").innerText
                }else{
                    bal['earnedPcSearch']='failed to get earnings'
                }
                if(document.querySelector(".mobilesearch")){
                    bal['earnedMobileSearch']=document.querySelector(".mobilesearch").innerText
                }else{
                    bal['earnedMobileSearch']='failed to get earnings'
                }
                if(document.querySelector(".credits2")){
                    bal['total']=document.querySelector(".credits2").innerText.split(' ')[0]
                }else{
                    bal['total']="failed"
                }
                return bal
            })
        `)
        await page.close()
        return bal
    }
    this.search=async function (text,inPage){
        try{
            await inPage.goto("https://www.bing.com/?setmkt=en-us&setlang=en-us", { waitUntil: 'load', timeout: 0 });
            await new Promise(async(resolve, reject) => {
                setTimeout(async function(){
                return resolve(await inPage.type('#sb_form_q',text+'\n',{waitUntil:'networkidle0'}));  
                },Math.random()*config.get('randomDelay')+config.get('searchDelay'))
            })
        }catch(e){
            console.log("Error Searching: "+e)
            return
        }
    }
    this.loadCookies=async function (prefix,cookiesPath,inPage,log){
        cookiesPath+='.json'
        const previousSession = fs.existsSync("cookies/"+prefix+"_"+cookiesPath)
        if (previousSession) {
        const content = fs.readFileSync("cookies/"+prefix+"_"+cookiesPath);
        const cookiesArr = JSON.parse(content);
        if (cookiesArr.length !== 0) {
            for (let cookie of cookiesArr) {
            await inPage.setCookie(cookie)
            }
            if(log){
            console.log('Session '+prefix+"_"+cookiesPath+' has been loaded in the browser')
            }
        }
        }else{
        console.log('Session '+prefix+"_"+cookiesPath+' could not be found')
        }
    }
    this.saveCookies=async function (prefix,cookiesPath,inPage){
        if (!fs.existsSync("cookies")) {
            fs.mkdirSync("cookies");
        }
        cookiesPath+='.json'
        const cookiesObject = await inPage.cookies()
        fs.writeFileSync("cookies/"+prefix+"_"+cookiesPath, JSON.stringify(cookiesObject,null,2));
        console.log('Session has been saved to ' + prefix+"_"+cookiesPath);
    }
    this.updateTrendingWords=async function (){
        var newTrendingSearches=[]
        try {
        const response = await fetch("https://trends.google.com/trends/trendingsearches/daily/rss?geo=US");
        parser.parseString(await response.text(), function(error, result) {
            if(error === null) {
                for(var item of result.rss.channel[0].item){
                newTrendingSearches.push(item.title[0])
                }
            }
            else {
                console.log("error getting trends")
                return
            }
        });
        } catch (e) {
        console.log("error getting trends: "+e)
        return
        }
        var trendingSearches=[]
        try{
        var trendingWordsText = fs.readFileSync('trendingSearches.json')
        trendingSearches=JSON.parse(trendingWordsText)
        }catch(e){
        console.log('Failed To Read trendingWords.json: '+e)
        }
        newTrendingSearches=newTrendingSearches.concat(trendingSearches)
        newTrendingSearches=Array.from(new Set(newTrendingSearches))
        newTrendingSearches.length = Math.min(1000,newTrendingSearches.length);
        fs.writeFileSync("trendingSearches.json", JSON.stringify(newTrendingSearches,null,2)); 
        return newTrendingSearches
    }
    this.sleep=function (ms) {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      }   
}