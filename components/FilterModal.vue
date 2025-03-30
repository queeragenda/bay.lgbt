<script setup lang="ts">
import { VueFinalModal } from 'vue-final-modal'
import { countyToCities, useCityEnablement, COUNTIES } from '#build/imports'

const props = defineProps<{
  title?: string
}>()
const emit = defineEmits(['confirm']);

const cityEnablement = useCityEnablement();

const onCountySet = (countyID: string, enablement: boolean) => {
  const cities = countyToCities()[countyID];
  for (let city of cities) {
    cityEnablement.value[city] = enablement;
  }
};

const onAllSet = (enablement: boolean) => {
  for (let city of allCities()) {
    cityEnablement.value[city.id] = enablement;
  }
}

const finish = () => {
  emit('confirm', cityEnablement.value);
}

</script>
<template>
  <VueFinalModal class="popper-box-wrapper" content-class="popper-box-inner" overlay-transition="vfm-fade"
    content-transition="vfm-fade">
    <CountyFilterItem label="All Cities" @on-yes="onAllSet(true)" @on-no="onAllSet(false)">
    </CountyFilterItem>

    <CountyFilterItem v-for="county in COUNTIES" :key="county.id" :label="county.name + ' County'"
      @on-yes="onCountySet(county.id, true)" @on-no="onCountySet(county.id, false)">

      <CityFilterItem v-for="city in county.cities" :label="city.name" v-model="cityEnablement[city.id]">
      </CityFilterItem>

      <CityFilterItem :label="'Others in ' + county.name + ' County'" v-model="cityEnablement[county.id]">
      </CityFilterItem>
    </CountyFilterItem>

    <div class="bottom">
      <button @click="finish()">
        Done
      </button>
    </div>
  </VueFinalModal>
</template>
