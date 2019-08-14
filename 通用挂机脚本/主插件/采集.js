var Async = require('async');
var cga = global.cga;
var configTable = global.configTable;

var gatherObject = null;
var mineObject = null;
var doneObject = require('./../公共模块/采集后操作');
var healObject = require('./../公共模块/治疗自己');
var supplyObject = require('./../公共模块/通用登出回补');

var gatherArray = [
{
	name : '挖矿',
	skill : '挖掘',
	path : './../公共模块/挖矿',
},
{
	name : '伐木',
	skill : '伐木',
	path : './../公共模块/伐木',
},
{
	name : '采花',
	skill : '伐木',
	path : './../公共模块/采花',
},
{
	name : '双百新城鹿皮',
	skill : '狩猎',
	path : './../公共模块/双百新城鹿皮',
},
{
	name : '双百伊尔鹿皮',
	skill : '狩猎体验',
	path : './../公共模块/双百伊尔鹿皮',
},
{
	name : '双百挖铜',
	skill : '挖矿',
	path : './../公共模块/双百挖铜',
},
{
	name : '双百买布',
	skill : null,
	path : './../公共模块/双百买布',
},
]

var check_drop = ()=>{
	var dropItemPos = -1;
	var pattern = /(.+)的卡片/;
	cga.getInventoryItems().forEach((item)=>{
		if(dropItemPos != -1)
			return;
		if(item.name == '魔石' || item.name == '卡片？' || pattern.exec(item.name) ) {
			dropItemPos = item.pos;
			return;
		}
		if(mineObject.object &&	mineObject.object.extra_dropping && mineObject.object.extra_dropping(item)) {
			dropItemPos = item.pos;
			return;
		}
	});
	
	if(dropItemPos != -1)
		cga.DropItem(dropItemPos);
}

var loop = ()=>{
	
	var skill = null;
	
	if(gatherObject.skill !== null){
		skill = cga.findPlayerSkill(gatherObject.skill);
		if(!skill){
			errmsg = '你没有'+gatherObject.skill+'技能';
			cga.SayWords(errmsg , 0, 3, 1);
			return;
		}
		if(mineObject.object && skill.lv < mineObject.object.level){
			var errmsg = gatherObject.skill+'技能等级不够，挖'+mineObject.object.name+'需要'+mineObject.object.level+'级，而你只有'+skill.lv+'级';
			cga.SayWords(errmsg , 0, 3, 1);
			return;
		}
	}
	
	var playerInfo = cga.GetPlayerInfo();
	if(playerInfo.mp < playerInfo.maxmp)
	{
		supplyObject.func(loop);		
		return;
	}
	
	if(playerInfo.health > 0){
		healObject.func(loop);
		return;
	}

	if(mineObject.check_done())
	{
		if(mineObject.doneManager)
			mineObject.doneManager(loop);
		else if(doneObject.func)
			doneObject.func(loop, mineObject.object);
		return;
	}
	
	var waitwait = (cb)=>{
		cga.AsyncWaitWorkingResult(()=>{
			var playerInfo = cga.GetPlayerInfo();
			if(playerInfo.mp == 0){
				cb('restart');
				return;
			}
			if(mineObject.check_done())
			{
				cb('restart');
				return;
			}
			if(playerInfo.health > 0){
				cb('heal');
				return;
			}
			
			check_drop();
			
			cga.StartWork(skill.index, 0);
			
			waitwait(cb);
		}, 10000);
	}
	
	var waitwait2 = (cb)=>{
		var playerInfo = cga.GetPlayerInfo();
		if(playerInfo.mp == 0){
			cb('restart');
			return;
		}
		if(mineObject.check_done()){
			cb('restart');
			return;
		}
		if(playerInfo.health > 0){
			cb('heal');
			return;
		}
		
		check_drop();
		
		setTimeout(waitwait2, 1500, cb);
	}
	
	var workwork = ()=>{
		
		var playerInfo = cga.GetPlayerInfo();
		if(playerInfo.mp == 0){
			loop();
			return;
		}
		
		if(skill != null){
			cga.StartWork(skill.index, 0);
			waitwait((r)=>{
				if(r == 'restart')
				{
					loop();
					return;
				}
				if(r == 'heal')
				{
					healObject.func(workwork);
					return;
				}
			});
		} else {
			waitwait2((r)=>{
				if(r == 'restart')
				{
					loop();
					return;
				}
				if(r == 'heal')
				{
					healObject.func(workwork);
					return;
				}
			});
		}
	}
	
	mineObject.func(workwork);
}

var thisobj = {
	getDangerLevel : ()=>{
		var map = cga.GetMapName();
		
		if(map == '芙蕾雅' )
			return 1;
		
		if(map == '米内葛尔岛' )
			return 2;
		
		if(map == '莎莲娜' )
			return 2;

		return 0;
	},
	translate : (pair)=>{
		
		if(pair.field == 'gatherObject'){
			pair.field = '采集类型';
			pair.value = gatherArray[pair.value].name;
			pair.translated = true;
			return true;
		}
		
		if(mineObject.translate(pair))
			return true;
		
		if(doneObject.translate(pair))
			return true;
		
		if(healObject.translate(pair))
			return true;
		
		return false;
	},
	loadconfig : (obj)=>{
		
		for(var i in gatherArray){
			if(i == obj.gatherObject){
				configTable.gatherObject = i;
				gatherObject = gatherArray[i];
				break;
			}
		}
		
		if(!gatherObject){
			console.error('读取配置：采集类型失败！');
			return false;
		}
		
		if(!mineObject)
			mineObject = require(gatherObject.path);

		if(!mineObject.loadconfig(obj))
			return false;
		
		if(!mineObject.doneManager){
			if(!doneObject.loadconfig(obj))
				return false;
		}
		
		if(!healObject.loadconfig(obj))
			return false;
		
		return true;
	},
	inputcb : (cb)=>{
		var sayString = '【采集插件】请选择采集类型:';
		for(var i in gatherArray){
			if(i != 0)
				sayString += ', ';
			sayString += '('+ (parseInt(i)+1) + ')' + gatherArray[i].name;
		}
		cga.sayLongWords(sayString, 0, 3, 1);
		cga.waitForChatInput((msg, index)=>{
			if(index !== null && index >= 1 && gatherArray[index - 1]){
				configTable.gatherObject = index - 1;
				gatherObject = gatherArray[index - 1];
				
				var sayString2 = '当前已选择:[' + gatherObject.name + ']。';
				cga.sayLongWords(sayString2, 0, 3, 1);
				
				if(mineObject === null)
					mineObject = require(gatherObject.path);
				
				if(!mineObject.doneManager){
					Async.series([mineObject.inputcb, doneObject.inputcb, healObject.inputcb], cb);
				} else {
					Async.series([mineObject.inputcb, healObject.inputcb], cb);
				}
				return false;
			}
			
			return true;
		});
	},
	execute : ()=>{
		callSubPlugins('init');
		mineObject.init();
		loop();
	},
};

module.exports = thisobj;