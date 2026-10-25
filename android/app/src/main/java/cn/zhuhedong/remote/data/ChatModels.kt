package cn.zhuhedong.remote.data

/** A1 chat/models wire models (Agent capability bridge `chat.*` / `models.*`). */

data class ChatSession(
    val sessionId: String,
    val title: String?,
    val cwd: String?,
    val space: String?,
    val updatedAt: Long,
    val running: Boolean,
    val blank: Boolean,
) {
    fun displayTitle(): String = title?.takeIf { it.isNotBlank() } ?: if (blank) "新任务" else "会话 " + sessionId.take(8)
}

data class ChatSpace(val name: String, val cwd: String, val count: Int)

data class AskOption(val label: String, val description: String? = null)

data class AskQuestion(
    val id: String,
    val question: String,
    val header: String? = null,
    val options: List<AskOption> = emptyList(),
    val multiSelect: Boolean = false,
)

data class AskPayload(val callId: String, val questions: List<AskQuestion>)

data class ChatMsg(
    val seq: Long,
    val role: String, // user | assistant | step
    val text: String,
    val status: String? = null, // running | done | error (steps)
    val name: String? = null,
    val callId: String? = null,
    val ask: AskPayload? = null,
)

data class ModelOption(val provider: String, val providerName: String, val id: String, val name: String)

data class ModelSel(val provider: String, val model: String)

data class FollowSnapshot(
    val version: Int,
    val unchanged: Boolean,
    val messages: List<ChatMsg>,
    val live: String,
    val running: Boolean,
    val error: String?,
    val pendingAsk: AskPayload? = null,
)

object ChatParse {
    private fun str(v: Any?): String? = (v as? String)?.takeIf { it.isNotEmpty() }
    private fun num(v: Any?): Long = when (v) { is Number -> v.toLong(); is String -> v.toLongOrNull() ?: 0L; else -> 0L }
    private fun list(v: Any?): List<Map<String, Any?>> =
        (v as? List<*>)?.mapNotNull { @Suppress("UNCHECKED_CAST") (it as? Map<String, Any?>) } ?: emptyList()

    fun sessions(data: Map<String, Any?>?): Pair<List<ChatSession>, List<ChatSpace>> {
        val s = list(data?.get("sessions")).mapNotNull { o ->
            val id = str(o["sessionId"]) ?: return@mapNotNull null
            ChatSession(id, str(o["title"]), str(o["cwd"]), str(o["space"]), num(o["updatedAt"]),
                o["running"] == true, o["blank"] == true)
        }
        val sp = list(data?.get("spaces")).mapNotNull { o ->
            ChatSpace(str(o["name"]) ?: return@mapNotNull null, str(o["cwd"]) ?: return@mapNotNull null, num(o["count"]).toInt())
        }
        return s to sp
    }

    @Suppress("UNCHECKED_CAST")
    fun askPayload(v: Any?): AskPayload? {
        val o = v as? Map<String, Any?> ?: return null
        val callId = str(o["callId"]) ?: return null
        val qs = list(o["questions"]).mapNotNull { q ->
            val id = str(q["id"]) ?: return@mapNotNull null
            val question = str(q["question"]) ?: return@mapNotNull null
            val options = list(q["options"]).mapNotNull { opt ->
                val label = str(opt["label"]) ?: return@mapNotNull null
                AskOption(label, str(opt["description"]))
            }
            AskQuestion(
                id = id,
                question = question,
                header = str(q["header"]),
                options = options,
                multiSelect = q["multiSelect"] == true || q["multi_select"] == true,
            )
        }
        if (qs.isEmpty()) return null
        return AskPayload(callId, qs)
    }

    fun messages(v: Any?): List<ChatMsg> = list(v).map { o ->
        ChatMsg(
            seq = num(o["seq"]),
            role = str(o["role"]) ?: "assistant",
            text = (o["text"] as? String) ?: "",
            status = str(o["status"]),
            name = str(o["name"]),
            callId = str(o["callId"]),
            ask = askPayload(o["ask"]),
        )
    }

    fun follow(data: Map<String, Any?>?): FollowSnapshot = FollowSnapshot(
        version = num(data?.get("version")).toInt(),
        unchanged = data?.get("unchanged") == true,
        messages = messages(data?.get("messages")),
        live = (data?.get("live") as? String) ?: "",
        running = data?.get("running") == true,
        error = str(data?.get("error")),
        pendingAsk = askPayload(data?.get("pendingAsk")),
    )

    fun models(data: Map<String, Any?>?): Pair<List<ModelOption>, ModelSel?> {
        val out = ArrayList<ModelOption>()
        for (g in list(data?.get("groups"))) {
            val pid = str(g["id"]) ?: continue
            val pname = str(g["name"]) ?: pid
            for (m in list(g["models"])) {
                val mid = str(m["id"]) ?: continue
                out.add(ModelOption(pid, pname, mid, str(m["name"]) ?: mid))
            }
        }
        @Suppress("UNCHECKED_CAST")
        val cur = data?.get("current") as? Map<String, Any?>
        val sel = cur?.let { c -> str(c["provider"])?.let { p -> str(c["model"])?.let { ModelSel(p, it) } } }
        return out to sel
    }
}
