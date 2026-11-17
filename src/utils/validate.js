import { loginUser } from "@/utils/common";
import { loginEmby, getEmbyInfo } from "@/utils/emby";
import { renameAccount } from '@/utils/sources/mulu';
import { openFolderPicker } from '@/utils/sources/picker';
import { i18n } from '@/i18n/index.js';

//校验webdav
export const validateWebdav = async (action, formData, oldData, routerParams, back = true, opts = {}) => {
    // 各端目录树路径与回退层数不同：手机 source-list→file-source→表单(delta 2)，TV 设置弹层→表单(delta 1)
    // 只有目录树路径需要按端区分；回退层数由 openFolderPicker 按页面栈自动推导
    const pickerPath = opts.pickerPath
    const isAdd = typeof action === 'boolean' ? action : action == "添加Openlist/Alist";
    let sourceList = uni.getStorageSync("sourceList");
    if (isAdd) {
        if (sourceList.find((i) => i.type == "WebDAV").list.find((i) => i.address == formData.address)) {
            uni.showToast({
                title: i18n.global.t('source.duplicateWebdavAddress'),
                icon: "none",
            });
            return;
        }
        if (sourceList.find((i) => i.type == "WebDAV").list.find((i) => i.name == formData.name)) {
            uni.showToast({
                title: i18n.global.t('source.duplicateWebdavName'),
                icon: "none",
            });
            return;
        }
        try {
            const res = await loginUser(formData)
            let isHaveData = !sourceList.every((item) => {
                return !item.list.length;
            });
            if (!isHaveData) {
                sourceList.find((i) => i.type == "WebDAV").list.push({ ...formData, token: res.data.token, active: true });
                uni.setStorageSync("isreload", true);
            } else {
                sourceList.find((i) => i.type == "WebDAV").list.push({ ...formData, token: res.data.token });
            }
            uni.setStorageSync("sourceList", sourceList);
            if (back) {
                // 添加成功后直接进导入页：勾选目录 + 选择导入到媒体库/资源库。
                // 不再要求用户事先声明「这是电影目录 / 电视剧目录」。
                openFolderPicker({
                    type: 'WebDAV',
                    name: formData.name,
                    mode: 'add',
                    path: pickerPath,
                });
            }
            return res
        } catch (error) {
            uni.showToast({
                title: i18n.global.t('source.authCheckFailed'),
                icon: "none",
            });
        }
    } else {
        if (sourceList.find((i) => i.type == "WebDAV").list.find((i) => i.address == formData.address) && oldData.address != formData.address) {
            uni.showToast({
                title: i18n.global.t('source.duplicateWebdavAddress'),
                icon: "none",
            });
            return;
        }
        if (sourceList.find((i) => i.type == "WebDAV").list.find((i) => i.name == formData.name) && oldData.name != formData.name) {
            uni.showToast({
                title: i18n.global.t('source.duplicateWebdavName'),
                icon: "none",
            });
            return;
        }

        try {
            const res = await loginUser(formData)
            let historyArr = uni.getStorageSync("historyPlay") || [];
            historyArr = historyArr.filter((v) => v.sourceType != "WebDAV" || v.sourceName != oldData.name);
            uni.setStorageSync("historyPlay", historyArr);
            formData.token = res.data.token;
            let obj = sourceList.find((i) => i.type == "WebDAV").list.find((i) => i.address == routerParams.address);
            Object.keys(formData).forEach((v) => {
                obj[v] = formData[v];
            });
            uni.setStorageSync("sourceList", sourceList);

            // 账号改名后同步 muluData 里的目录条目，否则该账号的导入目录会失联
            if (oldData?.name && oldData.name !== formData.name) {
                renameAccount('WebDAV', oldData.name, formData.name);
            }

            if (back) {
                // 修改同样进目录树：回填已导入目录，允许增删
                uni.setStorageSync("isreload", true);
                openFolderPicker({
                    type: 'WebDAV',
                    name: formData.name,
                    mode: 'edit',
                    path: pickerPath,
                });
                return res;
            }
            if (routerParams.isActive == "1") {
                uni.setStorageSync("isreload", true);
            }
            return res
        } catch (error) {
            uni.showToast({
                title: i18n.global.t('source.authCheckFailed'),
                icon: "none",
            });
        }
    }
}

//校验emby
export const validateEmby = async (action, formData, oldData, routerParams) => {
    const isAdd = typeof action === 'boolean' ? action : action == "添加Emby";
    let sourceList = uni.getStorageSync("sourceList");
    if (!sourceList.find((i) => i.type == "Emby")) {
        sourceList.push({ type: "Emby", list: [], img: "https://gimg3.baidu.com/search/src=https%3A%2F%2Ftiebapic.baidu.com%2Fforum%2Fw%253D120%253Bh%253D120%2Fsign%3D44147d7d4e82b2b7a79f3dc60196a3d2%2Fc9fcc3cec3fdfc03771506c1c33f8794a4c2265e.jpg%3Ftbpicau%3D2025-04-08-05_5fe90c457d4356ee146a73914e8a8871&refer=http%3A%2F%2Fwww.baidu.com&app=2021&size=w240&n=0&g=0n&q=75&fmt=auto?sec=1744045200&t=627b5377de1d3107a8a09cb4f65c9fdc" })
    }
    if (isAdd) {
        if (sourceList.find((i) => i.type == "Emby").list.find((i) => i.address == formData.address)) {
            uni.showToast({
                title: i18n.global.t('source.duplicateEmbyAddress'),
                icon: "none",
            });
            return;
        }
        if (sourceList.find((i) => i.type == "Emby").list.find((i) => i.name == formData.name)) {
            uni.showToast({
                title: i18n.global.t('source.duplicateEmbyName'),
                icon: "none",
            });
            return;
        }
        uni.showLoading({
            title: i18n.global.t('common.loading')
        })
        await loginEmby(formData)
            .then(async (res) => {
                uni.hideLoading()
                let isHaveData = !sourceList.every((item) => {
                    return !item.list.length;
                });
                let obj1 = {}
                if (!isHaveData) {
                    obj1 = { ...formData, userId: res.User.Id, token: res.AccessToken, active: true }
                    let embyInfo = await getEmbyInfo(obj1)
                    obj1.name = embyInfo.ServerName
                    sourceList.find((i) => i.type == "Emby").list.push(obj1);
                    uni.setStorageSync("isreload", true);
                } else {
                    obj1 = { ...formData, userId: res.User.Id, token: res.AccessToken }
                    let embyInfo = await getEmbyInfo(obj1)
                    obj1.name = embyInfo.ServerName
                    sourceList.find((i) => i.type == "Emby").list.push(obj1);
                }
                uni.setStorageSync("sourceList", sourceList);
                uni.navigateBack({
                    delta: 2,
                });
            })
            .catch(() => {
                uni.hideLoading()
                uni.showToast({
                    title: i18n.global.t('source.authCheckFailed'),
                    icon: "none",
                });
            });
    } else {
        if (sourceList.find((i) => i.type == "Emby").list.find((i) => i.address == formData.address) && oldData.address != formData.address) {
            uni.showToast({
                title: i18n.global.t('source.duplicateEmbyAddress'),
                icon: "none",
            });
            return;
        }
        if (sourceList.find((i) => i.type == "Emby").list.find((i) => i.name == formData.name) && oldData.name != formData.name) {
            uni.showToast({
                title: i18n.global.t('source.duplicateEmbyName'),
                icon: "none",
            });
            return;
        }
        uni.showLoading({
            title: i18n.global.t('common.loading')
        })
        await loginEmby(formData)
            .then((res) => {
                uni.hideLoading()
                let historyArr = uni.getStorageSync("historyPlay") || [];
                historyArr = historyArr.filter((v) => v.sourceType != "Emby" || v.sourceName != oldData.name);
                uni.setStorageSync("historyPlay", historyArr);
                formData.token = res.AccessToken;
                formData.userId = res.User.Id;
                let obj = sourceList.find((i) => i.type == "Emby").list.find((i) => i.address == routerParams.address);
                Object.keys(formData).forEach((v) => {
                    obj[v] = formData[v];
                });
                uni.setStorageSync("sourceList", sourceList);

                // 账号改名后同步 muluData 里的目录条目（Emby 不改名也会走到这里，判等后跳过）
                if (oldData?.name && oldData.name !== formData.name) {
                    renameAccount('Emby', oldData.name, formData.name);
                }

                if (routerParams.isActive == "1") {
                    uni.setStorageSync("isreload", true);
                    uni.navigateBack({
                        delta: 2,
                    });
                    return;
                }
                // Emby 是服务端媒体库，没有「扫描目录」概念，不入目录树
                uni.navigateBack();
            })
            .catch(() => {
                uni.hideLoading()
                uni.showToast({
                    title: i18n.global.t('source.authCheckFailed'),
                    icon: "none",
                });
            });
    }
}