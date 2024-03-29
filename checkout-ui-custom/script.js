let nostoEnabled = false

function waitElement(selector, fn) {
  if ($(selector).length) fn()

  const interval = setInterval(() => {
    if ($(selector).length) {
      clearInterval(interval)
      fn()
    }
  }, 200)
}

function updateNosto() {
  let nostoSettings = JSON.parse(
    localStorage.getItem('nosto-checkout-settings') ?? 'null'
  )

  for (let i = 0; i < 3; i++) {
    const getNostoSettingsTimeout = window.setTimeout(() => {
      $.getJSON('/_v/nosto-checkout/settings').done(data => {
        nostoSettings = data
        localStorage.setItem(
          'nosto-checkout-settings',
          JSON.stringify(nostoSettings)
        )
      })
    }, 200 * (i + 1))

    if (nostoSettings) {
      clearInterval(getNostoSettingsTimeout)
      break
    }
  }

  if (nostoSettings) {
    console.log('Nosto Settings:', nostoSettings)
    processNostoSettings(nostoSettings)
  }
}

function processNostoSettings(nostoSettings) {
  const {
    nostoAccountID,
    enableNosto,
    belowCartPlacementId,
    belowSummaryPlacementId,
  } = nostoSettings

  if (nostoAccountID && enableNosto) {
    if (!nostoEnabled) {
      $('head').append(`
              <script id="nostojs" type="text/javascript">
                (function(){var name="nostojs";window[name]=window[name]||function(cb){(window[name].q=window[name].q||[]).push(cb);};})();
              </script>
              <script src="https://connect.nosto.com/include/${nostoAccountID}" async></script>
            `)
      nostoEnabled = true
    }

    if (belowCartPlacementId && !$(`#${belowCartPlacementId}`).length) {
      $('.cart-template-holder').append(
        `<div class="nosto_element" id="${belowCartPlacementId}"></div>`
      )
    }

    if (belowSummaryPlacementId && !$(`#${belowSummaryPlacementId}`).length) {
      $('.custom-cart-template-wrap').append(
        `<div class="nosto_element" id="${belowSummaryPlacementId}"></div>`
      )
    }

    nostojs(api => {
      api
        .defaultSession()
        .setResponseMode('HTML')
        .viewFrontPage()
        .setPlacements(api?.placements?.getPlacements())
        .load()
        .then(response => {
          console.log('Updating placements:', response)
          api.placements.injectCampaigns(response.recommendations)
          Object.keys(response.recommendations).forEach(key => {
            $(`#${key} .nosto-header`).attr(
              'style',
              'font-family: inherit !important'
            )
          })
        })
    })

    waitElement('.nosto-header', () => {
      $('.nosto-header').attr('style', 'font-family: inherit !important')
    })

    const clientProfileData = vtexjs?.checkout?.orderForm?.clientProfileData
    const orderFormId = vtexjs?.checkout?.orderForm?.orderFormId
    const nostoCustomer = {
      customer_reference: orderFormId,
      email: clientProfileData?.email,
      first_name: clientProfileData?.firstName,
      last_name: clientProfileData?.lastName,
    }
    const currencyCode =
      vtexjs?.checkout?.orderForm?.storePreferencesData?.currencyCode
    const nostoCartItems = vtexjs?.checkout?.orderForm?.items?.map(item => ({
      name: item.name,
      price_currency_code: currencyCode,
      product_id: item.productId,
      quantity: item.quantity,
      sku_id: item.id,
      unit_price: +item.sellingPrice / 100,
    }))

    nostojs?.(api => {
      api
        .defaultSession()
        .setCart({ items: nostoCartItems })
        .setCustomer(nostoCustomer)
        .viewCart()
        .update()
        .then(data => {
          console.log('Cart sent to Nosto:', nostoCartItems)
          console.log('Customer sent to Nosto:', nostoCustomer)
          console.log('Nosto updated data:', data)
        })
    })
  }
}

function updateDemoStoreWarning() {
  if (!$('.demo-store-warning').length) {
    const demoWarning =
      '<div class="demo-store-warning">Attention! This is a VTEX platform demo store. Products, prices and deliveries are merely illustrative.</div>'

    $('.summary-template-holder').append(demoWarning)
  }
}

function updateButtons() {
  if (!$('#continue-shopping-button').length) {
    $('.btn-place-order-wrapper').append(
      $(
        '<a href="https://vtexfashion.vtex.app/" target="_self" id="continue-shopping-button" class="btn btn-large btn-secondary">Keep buying</a>'
      )
    )
  }

  const cartToOrderFormElement = document.getElementById('cart-to-orderform')

  const htmlCartToOrderForm = `
    PROCEED
    <svg width="14" height="12" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.9142 4.58594L8.62115 0.292942L7.20715 1.70694L10.5002 4.99994H0.500153V6.99994H10.5002L7.20715 10.2929L8.62115 11.7069L12.9142 7.41394C13.2891 7.03889 13.4997 6.53027 13.4997 5.99994C13.4997 5.46961 13.2891 4.961 12.9142 4.58594Z" fill="white"/>
    </svg>
  `

  $(cartToOrderFormElement).html(htmlCartToOrderForm)

  const observer = new MutationObserver(() => {
    observer.disconnect()
    waitElement('#cart-to-orderform', () => {
      $(cartToOrderFormElement).html(htmlCartToOrderForm)
    })
  })

  observer.observe(cartToOrderFormElement, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
    attributeOldValue: true,
    characterDataOldValue: true,
  })
}

window.addEventListener('DOMContentLoaded', () => {
  $(window).on('orderFormUpdated.vtex', () => {
    updateNosto()
    updateDemoStoreWarning()
    updateButtons()
  })

  $(window).on('deliverySelected.vtex hashchange', () => updateButtons())
})
