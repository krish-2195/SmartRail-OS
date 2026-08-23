import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/constants/theme.dart';
import '../../../core/widgets/floating_nav.dart';
import '../../../core/widgets/metro_drawer.dart';
import '../providers/train_search_provider.dart';

class LinesScreen extends ConsumerStatefulWidget {
  final String? initialLine;

  const LinesScreen({super.key, this.initialLine});

  @override
  ConsumerState<LinesScreen> createState() => _LinesScreenState();
}

class _LinesScreenState extends ConsumerState<LinesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialLine == 'red' ? 1 : 0,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const MetroDrawer(),
      body: Stack(
        children: [
          NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) {
              return [
                SliverAppBar(
                  expandedHeight: 160,
                  pinned: true,
                  floating: false,
                  backgroundColor: AppTheme.surfaceDark,
                  leading: Builder(
                    builder: (context) => IconButton(
                      icon: const Icon(Icons.menu_rounded, color: AppTheme.textPrimary),
                      onPressed: () => Scaffold.of(context).openDrawer(),
                      tooltip: 'Metro Menu',
                    ),
                  ),
                  flexibleSpace: FlexibleSpaceBar(
                    title: Text(
                      'METRO NETWORK',
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                        fontFamily: AppTheme.tabularNumberStyle.fontFamily,
                        fontSize: 16,
                      ),
                    ),
                    centerTitle: true,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppTheme.surfaceElevated, AppTheme.surfaceDark],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                      child: Stack(
                        children: [
                          Positioned(
                            right: -20,
                            top: -20,
                            child: Container(
                              width: 140,
                              height: 140,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppTheme.blueLine.withValues(alpha: 0.1),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  bottom: PreferredSize(
                    preferredSize: const Size.fromHeight(48),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceElevated,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0x1AFFFFFF)),
                      ),
                      child: TabBar(
                        controller: _tabController,
                        indicatorSize: TabBarIndicatorSize.tab,
                        indicator: BoxDecoration(
                          color: _tabController.index == 0 ? AppTheme.blueLine : AppTheme.redLine,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: (_tabController.index == 0 ? AppTheme.blueLine : AppTheme.redLine)
                                  .withValues(alpha: 0.3),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        labelColor: Colors.white,
                        unselectedLabelColor: AppTheme.textMuted,
                        labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                        tabs: const [
                          Tab(text: 'BLUE LINE · 18 STNS'),
                          Tab(text: 'RED LINE · 15 STNS'),
                        ],
                        onTap: (_) => setState(() {}),
                      ),
                    ),
                  ),
                ),
              ];
            },
            body: TabBarView(
              controller: _tabController,
              children: [
                _buildLineDetail(context, MetroLine.blue, blueLineStations),
                _buildLineDetail(context, MetroLine.red, redLineStations),
              ],
            ),
          ),

          // Bottom Nav Bar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: FloatingNav(
              currentIndex: 1,
              activeColor: _tabController.index == 0 ? AppTheme.blueLine : AppTheme.redLine,
              onTap: (index) {
                if (index == 0) context.go('/home');
                if (index == 2) context.push('/live');
                if (index == 3) context.push('/profile');
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLineDetail(BuildContext context, MetroLine line, List<Station> stations) {
    final isBlue = line == MetroLine.blue;
    final lineColor = isBlue ? AppTheme.blueLine : AppTheme.redLine;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
      children: [
        // Corridor Info Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: lineColor.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(color: lineColor, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isBlue ? 'EAST-WEST CORRIDOR' : 'NORTH-SOUTH CORRIDOR',
                        style: TextStyle(
                          color: lineColor,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.signalGreen.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      '8 MIN HEADWAY',
                      style: TextStyle(color: AppTheme.signalGreen, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                isBlue ? 'Vastral Gam ↔ Thaltej Gam' : 'APMC ↔ Motera Stadium',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.schedule_rounded, size: 13, color: AppTheme.textMuted),
                  const SizedBox(width: 4),
                  const Text('06:00 AM – 10:30 PM', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                  const SizedBox(width: 16),
                  const Icon(Icons.straighten_rounded, size: 13, color: AppTheme.textMuted),
                  const SizedBox(width: 4),
                  Text(isBlue ? '21.16 km' : '18.87 km', style: const TextStyle(color: AppTheme.textMuted, fontSize: 11)),
                ],
              ),
            ],
          ),
        ).animate().fadeIn(duration: 350.ms),

        const SizedBox(height: 20),

        const Text(
          'STATION SEQUENCE & INTERCHANGES',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
            color: AppTheme.textMuted,
          ),
        ),
        const SizedBox(height: 12),

        // Station Vertical Track List
        ...List.generate(stations.length, (index) {
          final station = stations[index];
          final isInterchange = station.name.contains('Old High Court');
          final isFirst = index == 0;
          final isLast = index == stations.length - 1;

          return _buildStationRow(
            context,
            station: station,
            lineColor: lineColor,
            isFirst: isFirst,
            isLast: isLast,
            isInterchange: isInterchange,
            index: index,
          );
        }),
      ],
    );
  }

  Widget _buildStationRow(
    BuildContext context, {
    required Station station,
    required Color lineColor,
    required bool isFirst,
    required bool isLast,
    required bool isInterchange,
    required int index,
  }) {
    return InkWell(
      onTap: () {
        // Quick set as from station and navigate to home
        ref.read(fromStationProvider.notifier).state = station;
        ref.read(selectedLineProvider.notifier).state = station.lineId;
        final currentTo = ref.read(toStationProvider);
        if (currentTo != null && (currentTo.id == station.id || currentTo.lineId != station.lineId)) {
          ref.read(toStationProvider.notifier).state = null;
        }
        context.go('/home');
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Track line & node column
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(
                  width: 3,
                  height: 16,
                  color: isFirst ? Colors.transparent : lineColor.withValues(alpha: 0.4),
                ),
                Container(
                  width: isInterchange ? 16 : 10,
                  height: isInterchange ? 16 : 10,
                  decoration: BoxDecoration(
                    color: isInterchange ? AppTheme.signalAmber : AppTheme.surfaceDark,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isInterchange ? Colors.white : lineColor,
                      width: 2,
                    ),
                  ),
                ),
                Container(
                  width: 3,
                  height: 36,
                  color: isLast ? Colors.transparent : lineColor.withValues(alpha: 0.4),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Station Content Card
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isInterchange
                    ? AppTheme.signalAmber.withValues(alpha: 0.08)
                    : AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isInterchange
                      ? AppTheme.signalAmber.withValues(alpha: 0.3)
                      : const Color(0x14FFFFFF),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: lineColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      station.id,
                      style: TextStyle(
                        color: lineColor,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          station.name,
                          style: TextStyle(
                            fontWeight: isInterchange ? FontWeight.w900 : FontWeight.bold,
                            fontSize: 13,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        if (isInterchange)
                          const Text(
                            'Interchange: Red Line ↔ Blue Line',
                            style: TextStyle(color: AppTheme.signalAmber, fontSize: 10, fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 18, color: AppTheme.textMuted),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
