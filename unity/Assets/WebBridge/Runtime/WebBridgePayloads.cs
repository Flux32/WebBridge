using System;
using System.Collections.Generic;
using UnityEngine.Scripting;

using WebBridge;

namespace Modules.Road
{
    [Preserve]
    [Serializable]
    public class WebGameConfigPayload
    {
        [JsonName("coefficients")]
        public float[] Coefficients;

        [JsonName("bonusCounts")]
        public Dictionary<string, int> BonusCounts;

        [JsonName("bonusModes")]
        public JsonValue BonusModes;

        [JsonName("currency")]
        public string Currency;

        [JsonName("minBetAmount")]
        public float? MinBetAmount;

        [JsonName("maxBetAmount")]
        public float? MaxBetAmount;

        [JsonName("balance")]
        public float? Balance;
    }

    // Состояние road-раунда: базовые поля платформы плюс своя специфика, которую
    // бэк кладёт на верхний уровень ответа (extendGameState).
    [Preserve]
    [Serializable]
    public class WebGameStatePayload : WebGameStateBase
    {
        [JsonName("lineNumber")]
        public int? Step;

        [JsonName("coinsCollected")]
        public int[] BonusStepsCollected;

        [JsonName("coinsTriggered")]
        public bool? BonusStepTriggered;

        [JsonName("bonusGame")]
        public WebBonusGamePayload BonusGame;

        [JsonName("isWinMain")]
        public bool? IsWinMain;
    }

    [Preserve]
    [Serializable]
    public class WebBonusGamePayload
    {
        [JsonName("bonusTotalCoefficient")]
        public float BonusTotalCoefficient;

        [JsonName("bonusTotalWin")]
        public string BonusTotalWin;

        [JsonName("bonusPositions")]
        public int[] BonusPositions;

        [JsonName("completedIterations")]
        public int? CompletedIterations;

        [JsonName("accumulatedCoefficient")]
        public float? AccumulatedCoefficient;

        [JsonName("accumulatedWin")]
        public float? AccumulatedWin;

        [JsonName("betAmount")]
        public float? BetAmount;

        [JsonName("bonusCurrency")]
        public string BonusCurrency;

        [JsonName("currentStep")]
        public int? CurrentStep;

        [JsonName("bonusCoefficients")]
        public string BonusCoefficients;

        [JsonName("difficulty")]
        public string Difficulty;
    }

    [Preserve]
    [Serializable]
    public class WebBonusAutoPlayProgress
    {
        [JsonName("positions")]
        public int[] Positions;

        [JsonName("completedIterations")]
        public int CompletedIterations;

        [JsonName("totalIterations")]
        public int TotalIterations;

        [JsonName("accumulatedCoefficient")]
        public float AccumulatedCoefficient;

        [JsonName("accumulatedWin")]
        public float AccumulatedWin;

        [JsonName("betAmount")]
        public float BetAmount;

        [JsonName("currency")]
        public string Currency;

        [JsonName("currentStep")]
        public int CurrentStep;

        [JsonName("difficulty")]
        public string Difficulty;

        [JsonName("bonusCoefficients")]
        public string BonusCoefficients;
    }

    // Unified payload for `StartBonus(payload)` — covers both fresh purchase
    // (completedIterations=0, accumulated*=0) and F5 restore (values from
    // saved progress). Mirrors WebBonusAutoPlayProgress field names plus
    // the bonus-game metadata (bonusTotalCoefficient/bonusTotalWin/modeId)
    // so SpinsBonus has everything in one place.
    [Preserve]
    [Serializable]
    public class WebBonusStartPayload
    {
        [JsonName("modeId")]
        public string ModeId;

        [JsonName("positions")]
        public int[] Positions;

        [JsonName("bonusCoefficients")]
        public string BonusCoefficients;

        [JsonName("difficulty")]
        public string Difficulty;

        [JsonName("betAmount")]
        public float BetAmount;

        [JsonName("currency")]
        public string Currency;

        // Display-only bet, already formatted the way cashout strings are ("$0.05"):
        // for crypto wallets React converts betAmount/currency (BTC, USDT, …) into the
        // display currency, so the bonus win table shows the same money the cashout
        // window shows. betAmount/currency stay in the WALLET currency — that is what
        // the progress saved back to React is measured in. Empty → fall back to
        // betAmount/currency (fiat wallets, older React builds).
        [JsonName("displayBet")]
        public string DisplayBet;

        [JsonName("bonusTotalCoefficient")]
        public float BonusTotalCoefficient;

        [JsonName("bonusTotalWin")]
        public string BonusTotalWin;

        [JsonName("completedIterations")]
        public int CompletedIterations;

        [JsonName("accumulatedCoefficient")]
        public float AccumulatedCoefficient;

        [JsonName("accumulatedWin")]
        public float AccumulatedWin;

        [JsonName("currentStep")]
        public int CurrentStep;
    }

    [Preserve]
    [Serializable]
    public class WebBonusPurchasePayload
    {
        [JsonName("modeId")]
        public string ModeId;

        [JsonName("isPurchased")]
        public bool IsPurchased;

        [JsonName("error")]
        public string Error;

        [JsonName("bonusGame")]
        public WebBonusGamePayload BonusGame;
    }

    [Preserve]
    [Serializable]
    public class WebBonusShopModePayload
    {
        public string ModeName;
        public string Price;
        public string Currency;
        public int BonusAmount;
    }

    [Preserve]
    [Serializable]
    public class WebUiVisibilityPayload
    {
        [JsonName("hideDesktopBetBar")]
        public bool HideDesktopBetBar;

        [JsonName("hideMobileBetBar")]
        public bool HideMobileBetBar;

        [JsonName("hideMobileLastWin")]
        public bool HideMobileLastWin;

        [JsonName("hideSettingsMenuButton")]
        public bool HideSettingsMenuButton;

        [JsonName("hideLogo")]
        public bool HideLogo;

        [JsonName("hideBottomBalancePanel")]
        public bool HideBottomBalancePanel;

        [JsonName("desktopBetBarInteractable")]
        public bool DesktopBetBarInteractable;

        [JsonName("mobileBetBarInteractable")]
        public bool MobileBetBarInteractable;
    }

    [Preserve]
    [Serializable]
    public class WebMobileBetBarViewportPayload
    {
        [JsonName("widthViewport")]
        public float WidthViewport;

        [JsonName("heightEndViewport")]
        public float HeightEndViewport;

        [JsonName("heightEndWithoutBonusViewport")]
        public float HeightEndWithoutBonusViewport;

        [JsonName("bonusButtonRight")]
        public WebViewportPoint BonusButtonRight;

        [JsonName("betBarRight")]
        public WebViewportPoint BetBarRight;

        [JsonName("bonusProgressIndicator")]
        public WebViewportRect BonusProgressIndicator;
    }

    [Preserve]
    [Serializable]
    public class WebViewportPoint
    {
        [JsonName("x")]
        public float X;

        [JsonName("y")]
        public float Y;
    }

    [Preserve]
    [Serializable]
    public class WebViewportRect
    {
        [JsonName("topLeft")]
        public WebViewportPoint TopLeft;

        [JsonName("topRight")]
        public WebViewportPoint TopRight;

        [JsonName("bottomLeft")]
        public WebViewportPoint BottomLeft;

        [JsonName("bottomRight")]
        public WebViewportPoint BottomRight;
    }

    [Preserve]
    [Serializable]
    public class WebBetBarHideStatePayload
    {
        [JsonName("hideDesktopBetBar")]
        public bool HideDesktopBetBar;

        [JsonName("hideMobileBetBar")]
        public bool HideMobileBetBar;
    }

    [Preserve]
    public class StepResultAction
    {
        public bool IsWin;
        public bool BonusStepTriggered;
    }
}
