using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Modules.Road
{
    [Serializable]
    public class WebGameConfigPayload
    {
        [JsonProperty("coefficients")]
        public float[] Coefficients;

        [JsonProperty("bonusCounts")]
        public Dictionary<string, int> BonusCounts;

        [JsonProperty("bonusModes")]
        public JToken BonusModes;

        [JsonProperty("currency")]
        public string Currency;

        [JsonProperty("minBetAmount")]
        public float? MinBetAmount;

        [JsonProperty("maxBetAmount")]
        public float? MaxBetAmount;
    }

    [Serializable]
    public class WebGameStatePayload
    {
        [JsonProperty("status")]
        public string Status;

        [JsonProperty("lineNumber")]
        public int? Step;

        [JsonProperty("coinsCollected")]
        public int[] BonusStepsCollected;

        [JsonProperty("coinsTriggered")]
        public bool? BonusStepTriggered;

        [JsonProperty("bonusGame")]
        public WebBonusGamePayload BonusGame;

        [JsonProperty("isWinMain")]
        public bool? IsWinMain;
    }

    [Serializable]
    public class WebBonusGamePayload
    {
        [JsonProperty("bonusTotalCoefficient")]
        public float BonusTotalCoefficient;

        [JsonProperty("bonusTotalWin")]
        public string BonusTotalWin;

        [JsonProperty("bonusPositions")]
        public int[] BonusPositions;
    }

    [Serializable]
    public class WebBonusPurchasePayload
    {
        [JsonProperty("modeId")]
        public string ModeId;

        [JsonProperty("isPurchased")]
        public bool IsPurchased;

        [JsonProperty("error")]
        public string Error;

        [JsonProperty("bonusGame")]
        public WebBonusGamePayload BonusGame;
    }

    [Serializable]
    public class WebBetActionMessage
    {
        [JsonProperty("action")]
        public string Action;

        [JsonProperty("payload")]
        public WebBetActionPayload Payload;
    }

    [Serializable]
    public class WebBetActionPayload
    {
        [JsonProperty("betAmount")]
        public string BetAmount;

        [JsonProperty("currency")]
        public string Currency;

        [JsonProperty("difficulty")]
        public string Difficulty;

        [JsonProperty("bonusType")]
        public string BonusType;
    }

    [Serializable]
    public class WebBonusShopModePayload
    {
        public string ModeName;
        public string Price;
        public string Currency;
        public int BonusAmount;
    }

    [Serializable]
    public class WebUiVisibilityPayload
    {
        [JsonProperty("hideDesktopBetBar")]
        public bool HideDesktopBetBar;

        [JsonProperty("hideMobileBetBar")]
        public bool HideMobileBetBar;

        [JsonProperty("hideMobileLastWin")]
        public bool HideMobileLastWin;

        [JsonProperty("hideSettingsMenuButton")]
        public bool HideSettingsMenuButton;

        [JsonProperty("hideLogo")]
        public bool HideLogo;

        [JsonProperty("desktopBetBarInteractable")]
        public bool DesktopBetBarInteractable;

        [JsonProperty("mobileBetBarInteractable")]
        public bool MobileBetBarInteractable;
    }

    [Serializable]
    public class WebMobileBetBarViewportPayload
    {
        [JsonProperty("widthViewport")]
        public float WidthViewport;

        [JsonProperty("heightEndViewport")]
        public float HeightEndViewport;
    }

    [Serializable]
    public class WebBetBarHideStatePayload
    {
        [JsonProperty("hideDesktopBetBar")]
        public bool HideDesktopBetBar;

        [JsonProperty("hideMobileBetBar")]
        public bool HideMobileBetBar;
    }

    [Serializable]
    public class WebGameRestorePayload
    {
        [JsonProperty("config")]
        public WebGameConfigPayload Config;

        [JsonProperty("state")]
        public WebGameStatePayload State;
    }

    public class StepResultAction
    {
        public bool IsWin;
        public bool BonusStepTriggered;
        public string AutoCashoutAmount;
    }
}
