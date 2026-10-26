package cn.zhuhedong.remote

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import cn.zhuhedong.remote.ui.genui.GenUiBlock
import cn.zhuhedong.remote.ui.genui.parseGenUiSpec
import cn.zhuhedong.remote.ui.home.MdBlock
import cn.zhuhedong.remote.ui.home.MarkdownText
import cn.zhuhedong.remote.ui.home.parseMarkdown
import cn.zhuhedong.remote.ui.theme.DshRemoteTheme
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w390dp-h2400dp-xxhdpi", application = android.app.Application::class)
class GenUiTest {
    @get:Rule val rule = createComposeRule()
    private val dir = System.getProperty("shots.dir") ?: "build/shots"

    private val spec = """{"title":"第四轮问题修复完成","gap":14,"items":[
      {"type":"hero","label":"通过率","value":"100%","delta":"+12%","title":"全部 8 类问题已修复","subtitle":"tsc / eslint / 47 个用例全绿","tone":"success"},
      {"type":"grid","cols":4,"items":[{"type":"stat","label":"修改文件","value":"26","delta":"+4"},{"type":"stat","label":"新增测试","value":"9"},{"type":"stat","label":"失败","value":"0","delta":"-3"},{"type":"stat","label":"耗时","value":"45s","spark":[3,5,4,8,6]}]},
      {"type":"callout","tone":"success","title":"全量验证通过","content":"所有 **重点** 问题已处理，`npm test` 全绿，==无回归==。"},
      {"type":"table","columns":["模块","状态","进度","变化"],"types":["text","badge","bar","delta"],"rows":[["用户管理","已修复","100","+3"],["角色","已修复","80","-1"],["字典","待复核","40","+0"]],"details":[[{"type":"keyvalue","pairs":[{"key":"文件","value":"user.tsx"}]}],null,null],"total":true},
      {"type":"row","items":[{"type":"badge","label":"TS","tone":"accent"},{"type":"badge","label":"React","tone":"success"},{"type":"badge","label":"风险","tone":"danger"}]},
      {"type":"list","items":[{"title":"公告编辑","desc":"先拉详情再编辑"},"纯文本条目",{"type":"badge","label":"嵌套"}]},
      {"type":"steps","current":1,"steps":[{"title":"复现","desc":"打开页面"},{"title":"定位","desc":"看日志"},{"title":"修复"}]},
      {"type":"chart","kind":"bars","data":[{"label":"一月","value":8},{"label":"二月","value":12},{"label":"三月","value":5}]},
      {"type":"chart","kind":"donut","data":[{"label":"通过","value":40},{"label":"失败","value":2}]},
      {"type":"progress","label":"覆盖率","value":72,"valueLabel":"72%"},
      {"type":"tabs","tabs":[{"label":"概览","items":[{"type":"text","content":"第一页"}]},{"label":"明细"}]},
      {"type":"accordion","items":[{"title":"展开看更多","items":[{"type":"text","content":"x"}]}]},
      {"type":"diff","diffs":[{"path":"a.ts","oldText":"foo()","newText":"bar()"}]},
      {"type":"radio","label":"1+1=?","group":"q1","options":["1","2"],"answer":1,"explanation":"基本算术"},
      {"type":"submit","label":"交卷","action":"grade","groups":["q1"]},
      {"type":"input","label":"筛选","placeholder":"输入关键字","id":"f"},
      {"type":"select","label":"环境","options":["dev","prod"],"selected":0},
      {"type":"checkbox","label":"包含已归档"},{"type":"switch","label":"自动刷新","checked":true},
      {"type":"row","items":[{"type":"button","label":"继续修复","tone":"primary","action":"next"},{"type":"button","label":"无动作"}]},
      {"type":"echart","title":"ECharts 图","preset":"line","data":[]},
      {"type":"mermaid","code":"graph TD\nA-->B"}
    ]}"""

    @Test fun parsesFences() {
        val md = "前言\n```json dsh-ui\n{\"items\":[]}\n```\n后记\n```dsh-ui\n{\"items\":["
        val b = parseMarkdown(md)
        val ui = b.filterIsInstance<MdBlock.GenUi>()
        assertEquals(2, ui.size); assertTrue(ui[0].closed); assertTrue(!ui[1].closed)
        assertNotNull(parseGenUiSpec("{\"items\":[{\"type\":\"text\",\"content\":\"a\"},]}</p>"))
        assertNotNull(parseGenUiSpec(spec))
    }

    @Test fun rendersAll() {
        rule.setContent { DshRemoteTheme { Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
            MarkdownText("修复完成，以下是本轮改动。\n```dsh-ui\n$spec\n```\n收尾一句。")
            GenUiBlock("{broken", true)
        } } }
        rule.onRoot().captureRoboImage("$dir/genui.png")
    }
}
