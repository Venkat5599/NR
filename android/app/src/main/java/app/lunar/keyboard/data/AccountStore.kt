package app.lunar.keyboard.data

import android.content.Context
import app.lunar.keyboard.near.KeyPair

/**
 * The testnet account this phone set up. On testnet the app also keeps the account's
 * full-access key, standing in for a wallet; the keyboard itself only ever uses the
 * function-call key, which can call `pay` on the Lunar contract and nothing else.
 */
class AccountStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("account", Context.MODE_PRIVATE)

    val accountId: String? get() = prefs.getString("account", null)

    /** Only the setup app reads this. The keyboard service never calls it. */
    fun walletKey(): KeyPair? = prefs.getString("wallet", null)?.let { KeyPair.fromSecret(it) }

    fun keyboardKey(): KeyPair? = prefs.getString("keyboard", null)?.let { KeyPair.fromSecret(it) }

    val isReady: Boolean get() = prefs.getBoolean("ready", false) && accountId != null

    fun saveNew(account: String, wallet: KeyPair, keyboard: KeyPair) {
        prefs.edit()
            .putString("account", account)
            .putString("wallet", wallet.secretKeyString)
            .putString("keyboard", keyboard.secretKeyString)
            .putBoolean("ready", false)
            .apply()
    }

    fun markReady() = prefs.edit().putBoolean("ready", true).apply()

    fun forget() = prefs.edit().clear().apply()
}
