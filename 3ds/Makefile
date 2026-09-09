# Vigia AI - Nintendo 3DS app (devkitARM + libctru + citro2d)
# Gera .3dsx (Homebrew Launcher) e .cia (FBI/Luma3DS)
# Toolchain: https://devkitpro.org/wiki/Getting_Started
#
# Uso:
#   make            # -> vigia-ai.3dsx + vigia-ai.elf
#   make cia        # -> vigia-ai.cia (precisa makerom + bannertool)
#   make clean

ifeq ($(strip $(DEVKITARM)),)
$(error "Defina DEVKITARM. Instale devkitPro: https://devkitpro.org/wiki/Getting_Started")
endif
ifeq ($(strip $(DEVKITPRO)),)
$(error "Defina DEVKITPRO")
endif

TOPDIR ?= $(CURDIR)
include $(DEVKITARM)/3ds_rules

# ----- App metadata (SMDH / CIA) -----
APP_TITLE       := Vigia AI
APP_DESCRIPTION := Painel de cotas - ESP32 port para 3DS
APP_AUTHOR      := TrindadeBRA
APP_VERSION_MAJOR := 1
APP_VERSION_MINOR := 0
APP_VERSION_MICRO := 0

# TitleID unico para CIA (0x... - range homebrew). Nao colidir com retail.
# Ver https://www.3dbrew.org/wiki/Title_list
APP_TITLEID     := 0xCE000000
APP_PRODUCT_CODE := CTR-P-VIGIA
APP_UNIQUE_ID   := 0xCE000

ICON   := resources/icon.png
BANNER := resources/banner.png
AUDIO  := resources/banner.wav
RSF    := resources/vigia.rsf
BNRTOOL_FLAGS :=

# ----- Build -----
TARGET   := vigia-ai
BUILD    := build
SOURCES  := src src/core src/net src/ui src/ui/views src/input
INCLUDES := include src
DATA     := data
GRAPHICS :=

# cia deps
BANNERTOOL ?= bannertool
MAKEROM    ?= makerom

LIBS    := -lcitro2d -lcitro3d -lctru -lm
LIBDIRS := $(CTRULIB) $(PORTLIBS)

# Includes / libpaths — precisam vir ANTES de CFLAGS (:= expande na hora)
INCLUDE  := $(foreach dir,$(INCLUDES),-I$(TOPDIR)/$(dir)) \
            $(foreach dir,$(LIBDIRS),-I$(dir)/include) \
            -I$(TOPDIR)/$(BUILD)
LIBPATHS := $(foreach dir,$(LIBDIRS),-L$(dir)/lib)

ARCH   := -march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
CFLAGS := -g -Wall -O2 -mword-relocations -ffunction-sections -fdata-sections \
          $(ARCH) $(INCLUDE) -D__3DS__ \
          -DVIGIA_VERSION=\"$(APP_VERSION_MAJOR).$(APP_VERSION_MINOR).$(APP_VERSION_MICRO)\"

CXXFLAGS := $(CFLAGS) -std=c++17 -fno-rtti -fno-exceptions

ASFLAGS := -g $(ARCH)
LDFLAGS  = -specs=3dsx.specs -g $(ARCH) -Wl,-Map,$(notdir $*.map)

# ----- File lists -----
ifneq ($(BUILD),$(notdir $(CURDIR)))
export OUTPUT := $(CURDIR)/$(TARGET)
export TOPDIR  := $(CURDIR)
export VPATH   := $(foreach dir,$(SOURCES),$(CURDIR)/$(dir)) \
                  $(foreach dir,$(DATA),$(CURDIR)/$(dir)) \
                  $(foreach dir,$(GRAPHICS),$(CURDIR)/$(dir))
export DEPSDIR := $(CURDIR)/$(BUILD)

CFILES      := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.c)))
CPPFILES    := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.cpp)))
SFILES      := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.s)))
PICAFILES   := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.v.pica)))
SHLISTFILES := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.shlist)))
BINFILES    := $(foreach dir,$(DATA),$(notdir $(wildcard $(dir)/*.*)))

ifeq ($(strip $(CPPFILES)),)
  export LD := $(CC)
else
  export LD := $(CXX)
endif

export OFILES_SOURCES := $(CPPFILES:.cpp=.o) $(CFILES:.c=.o) $(SFILES:.s=.o)
export OFILES_BIN     := $(addsuffix .o,$(BINFILES)) $(PICAFILES:.v.pica=.shbin.o) $(SHLISTFILES:.shlist=.shbin.o)
export OFILES := $(OFILES_BIN) $(OFILES_SOURCES)
export HFILES := $(PICAFILES:.v.pica=_shbin.h) $(SHLISTFILES:.shlist=_shbin.h) $(addsuffix .h,$(subst .,_,$(BINFILES)))

.PHONY: all clean cia banner

all: $(BUILD) $(OUTPUT).3dsx

$(BUILD):
	@mkdir -p $@

$(OUTPUT).3dsx $(OUTPUT).elf: $(OFILES)

# CIA - banner opcional se bannertool nao existir (icon via smdhtool)
BANNERTOOL_EXISTS := $(shell command -v $(BANNERTOOL) >/dev/null 2>&1 && echo 1 || echo 0)
ifeq ($(BANNERTOOL_EXISTS),1)
BANNER_DEPS := $(BUILD)/banner.bnr $(BUILD)/icon.icn
MAKEROM_BANNER := -banner $(BUILD)/banner.bnr
else
BANNER_DEPS := $(BUILD)/icon.icn
MAKEROM_BANNER :=
endif

cia: $(OUTPUT).cia

$(OUTPUT).cia: $(OUTPUT).elf $(OUTPUT).rsf $(BANNER_DEPS)
	@if ! command -v $(MAKEROM) >/dev/null 2>&1; then \
		echo "erro: $(MAKEROM) nao encontrado — cia precisa de makerom" >&2; \
		echo "  Docker: ./dev 3ds cia tenta baixar makerom automaticamente" >&2; \
		echo "  macOS: dkp-pacman -S 3ds-tools  ou  https://github.com/profi200/Project_CTR/releases" >&2; \
		echo "  .3dsx ja foi gerado em $(OUTPUT).3dsx (use pelo Homebrew Launcher)" >&2; \
		exit 1; \
	fi
	$(MAKEROM) -f cia -o $@ -elf $(OUTPUT).elf -rsf $(OUTPUT).rsf -desc app:1 \
		-target t -exefslogo -icon $(BUILD)/icon.icn $(MAKEROM_BANNER) \
		-major $(APP_VERSION_MAJOR) -minor $(APP_VERSION_MINOR) -micro $(APP_VERSION_MICRO) -DSaveSize=0

banner: $(BANNER_DEPS)

$(BUILD)/banner.bnr: $(BANNER) $(AUDIO)
	@mkdir -p $(BUILD)
	$(BANNERTOOL) makebanner -i $(BANNER) -a $(AUDIO) -o $@

$(BUILD)/icon.icn: $(ICON)
	@mkdir -p $(BUILD)
	@if command -v $(BANNERTOOL) >/dev/null 2>&1; then \
		$(BANNERTOOL) makesmdh -s "$(APP_TITLE)" -l "$(APP_TITLE)" -p "$(APP_AUTHOR)" -i $(ICON) -o $@; \
	else \
		smdhtool --create "$(APP_TITLE)" "$(APP_DESCRIPTION)" "$(APP_AUTHOR)" $(ICON) $@; \
	fi

$(OUTPUT).rsf: $(RSF)
	@cp $< $@

clean:
	@echo clean ...
	@rm -fr $(BUILD) $(TARGET).3dsx $(TARGET).elf $(TARGET).cia $(TARGET).rsf

# ----- deps -----
-include $(DEPSDIR)/*.d

endif
