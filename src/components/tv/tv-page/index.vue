<template>
	<scroll-view :scroll-y="true" :style="{ height: '100%' }" ref="page" :scroll-top="scrollTop"
		:scroll-with-animation="true" class="tv-page">
		<view @click="whole.onClick" id="onClick"></view>
		<slot></slot>
	</scroll-view>
</template>

<script>
export default {
	props: {
		scrollTop: Number,
	},
	data() {
		return {};
	},
	methods: {
		keyCodeClick(keyCode) {
			//   this.key = keyCode;
			//   uni.$emit("keyDown", keyCode);
			console.log(keyCode, "123");
			this.$emit("keyCodeClick", keyCode);
			switch (keyCode) {
				case "KeyUp":
					//   this.evtArrow("up");
					break;
				case "KeyDown":
					//   this.evtArrow("down");
					break;
				case "KeyLeft":
					//   this.evtArrow("left");
					break;
				case "KeyRight":
					//   this.evtArrow("right");
					break;
				case "KeyEnter":
					//   this.evtEnter();
					break;
				case "KeyBack":
					//   this.evtBack();
					break;
			}
		},
	},
};
</script>
<script module="whole" lang="renderjs">
import { IS_TV } from '../../../utils/config.js'
	let code = null;
	let KeyName = {
		19: 'KeyUp',
		38: 'KeyUp', //Keyboard
		20: 'KeyDown',
		40: 'KeyDown', //Keyboard
		21: 'KeyLeft',
		37: 'KeyLeft', //Keyboard
		22: 'KeyRight',
		39: 'KeyRight', //Keyboard
		23: 'KeyEnter',
		13: 'KeyEnter', //Keyboard
		4: 'KeyBack',
		18: 'KeyBack', //Keyboard Alt键
		27: 'KeyBack', //Keyboard ESC
		24: 'KeyBack', //Keyboard ESC
		66: 'KeyEnter',
		111: 'KeyBack'
	};
	export default {
		mounted() {
			console.log("监听");
			//动态计算电视端的html标签的font-size，用于适配，720p，1080p，2k，4k
			if (IS_TV) {
				let fontSize = window.innerWidth / 1280 * 16 + 'px'
				document.documentElement.style.setProperty('--tv-fontsize', fontSize);
			}
			//全局监听按键输入
			window.document.onkeydown = this.onKeydown
		},
		beforeDestroy() {
			window.document.onkeydown = null;
		},
		methods: {
			onKeydown(evt) {
				evt = evt || window.event;
				var KeyCode = evt.which || evt.keyCode;
				let preventArr = ['KeyUp', 'KeyDown', 'KeyLeft', 'KeyRight', 'KeyEnter']
				code = KeyName[KeyCode];
				if (preventArr.includes(code)) {
					evt.preventDefault();
				}
				if (code != undefined) {
					document.getElementById("onClick").click();
				}
			},
			onClick(event, ownerInstance) {
				// event.preventDefault();
				console.log(ownerInstance, 'ownerInstance');

				ownerInstance.callMethod('keyCodeClick', code);
			}
		}
	}
</script>
<style scoped lang="scss">
.tv-page {
	width: 100%;
	height: 100%;
	overflow: auto;
}
</style>